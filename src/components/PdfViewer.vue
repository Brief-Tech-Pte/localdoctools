<template>
  <div ref="viewerRef" class="page-viewer">
    <canvas ref="canvasRef" class="page-canvas" />
    <div
      v-if="currentViewport"
      ref="textLayerRef"
      class="textLayer"
      :class="{ enabled: textSelectMode }"
      @mouseup="handleTextSelectionEnd"
      @touchend="handleTextSelectionEnd"
    />
    <div
      v-if="currentViewport"
      ref="overlayRef"
      class="page-overlay"
      :class="{ disabled: textSelectMode }"
      @pointerdown="handleOverlayPointerDown"
      @pointermove="handleOverlayPointerMove"
      @pointerup="handleOverlayPointerUp"
      @pointercancel="handleOverlayPointerCancel"
    >
      <slot name="overlay">
        <div v-for="rect in overlayRects" :key="rect.id" class="overlay-rect" :style="rect.style" />
        <div
          v-if="showDrawingRect && drawingRectStyle"
          class="overlay-rect drawing"
          :style="drawingRectStyle"
        />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, toRefs, watch } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import type * as PdfJsTypes from 'pdfjs-dist'
import * as pdfjsViewer from 'pdfjs-dist/web/pdf_viewer.mjs'
import type {
  OverlayPointerPayload,
  PdfRect,
  PdfViewport,
  TextSelectionPayload,
  ViewerPoint,
  ViewerRect,
} from './pdfViewerTypes'

type PDFDocumentProxy = PdfJsTypes.PDFDocumentProxy

const globalPdfjsNamespace = globalThis as unknown as { pdfjsLib?: typeof pdfjsLib }
if (!globalPdfjsNamespace.pdfjsLib) {
  globalPdfjsNamespace.pdfjsLib = pdfjsLib
}

interface OverlayRectStyle {
  id: string
  style: Record<string, string>
}

const props = defineProps<{
  document?: PdfJsTypes.PDFDocumentProxy | null
  pageIndex: number
  textSelectMode: boolean
  overlayRects: OverlayRectStyle[]
  drawingRectStyle?: Record<string, string>
  showDrawingRect?: boolean
  minScale?: number
  maxScale?: number
  showRawTextLayer?: boolean
}>()

const emit = defineEmits<{
  (e: 'document-loaded', payload: { pageCount: number }): void
  (e: 'document-unloaded'): void
  (e: 'rendered', payload: { viewport: PdfViewport }): void
  (e: 'load-error', payload: { error: unknown }): void
  (e: 'render-error', payload: { error: unknown }): void
  (e: 'overlay-pointer-down', payload: OverlayPointerPayload): void
  (e: 'overlay-pointer-move', payload: OverlayPointerPayload): void
  (e: 'overlay-pointer-up', payload: OverlayPointerPayload): void
  (e: 'overlay-pointer-cancel', payload: { pointerId: number }): void
  (e: 'text-selection', payload: TextSelectionPayload): void
}>()

type OverlayPointRect = ViewerRect

const canvasRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLDivElement | null>(null)
const viewerRef = ref<HTMLDivElement | null>(null)
const textLayerRef = ref<HTMLDivElement | null>(null)
const currentViewport = ref<PdfViewport | null>(null)

const { textSelectMode, overlayRects, drawingRectStyle, showDrawingRect } = toRefs(props)
const showRawTextLayer = computed(() => props.showRawTextLayer ?? false)

const overlayPointerId = ref<number | null>(null)

let pdfDoc: PDFDocumentProxy | null = null
let renderTask: ReturnType<PdfJsTypes.PDFPageProxy['render']> | null = null

const minScale = computed(() => props.minScale ?? 0.5)
const maxScale = computed(() => props.maxScale ?? 2)

watch(
  () => props.document ?? null,
  async (newDocument, oldDocument) => {
    if (newDocument === oldDocument) return
    await setDocument(newDocument)
  },
  { immediate: true }
)

watch(
  () => props.pageIndex,
  async (newIndex, oldIndex) => {
    if (newIndex === oldIndex) return
    await renderCurrentPage()
  }
)

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  cancelRenderTask()
  void setDocument(null)
})

async function setDocument(nextDocument: PDFDocumentProxy | null) {
  const current = pdfDoc
  if (current === nextDocument) return

  cancelRenderTask()

  const hadDocument = Boolean(current)
  pdfDoc = nextDocument ? markRaw(nextDocument) : null
  currentViewport.value = null

  if (hadDocument) {
    emit('document-unloaded')
  }

  if (pdfDoc) {
    emit('document-loaded', { pageCount: pdfDoc.numPages })
    await nextTick()
    await renderCurrentPage()
  }
}

async function renderCurrentPage() {
  if (!pdfDoc || !canvasRef.value) return
  const targetIndex = clamp(props.pageIndex, 0, Math.max(pdfDoc.numPages - 1, 0))
  const pageNumber = targetIndex + 1
  const page = await pdfDoc.getPage(pageNumber)
  const baseViewport = page.getViewport({ scale: 1 })
  await nextTick()

  const containerWidth = viewerRef.value?.clientWidth ?? baseViewport.width
  const rawScale = containerWidth ? containerWidth / baseViewport.width : 1
  const scale = clamp(rawScale, minScale.value, maxScale.value)
  const viewport = page.getViewport({ scale })
  const canvas = canvasRef.value
  const context = canvas.getContext('2d')
  if (!context) return

  cancelRenderTask()

  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`

  const task = page.render({
    canvasContext: context,
    viewport,
    canvas,
  })
  renderTask = task

  try {
    await task.promise
  } catch (error) {
    if ((error as { name?: string }).name !== 'RenderingCancelledException') {
      emit('render-error', { error })
      console.error(error)
    }
    return
  } finally {
    renderTask = null
  }

  currentViewport.value = {
    width: viewport.width,
    height: viewport.height,
    scale,
  }
  emit('rendered', { viewport: currentViewport.value })

  await nextTick()
  await renderTextLayer(page, viewport)
}

function cancelRenderTask() {
  if (renderTask) {
    try {
      renderTask.cancel()
    } catch (error) {
      console.warn('Render task cancel failed', error)
    }
    renderTask = null
  }
}

async function renderTextLayer(page: PdfJsTypes.PDFPageProxy, viewport: PdfJsTypes.PageViewport) {
  let node = textLayerRef.value
  if (!node) {
    await nextTick()
    node = textLayerRef.value
  }
  if (!node) return
  node.innerHTML = ''
  try {
    node.style.width = `${viewport.width}px`
    node.style.height = `${viewport.height}px`
    applyTextLayerViewportStyles(node, viewport)
    applyTextLayerDebugStyles(node)
    const textLayer = new pdfjsViewer.TextLayerBuilder({ pdfPage: page })
    textLayer.div = node
    const textViewport = viewport.clone({ dontFlip: true })
    await textLayer.render({ viewport: textViewport })
    // Reapply sizing – render resets inline styles in some builds
    node.style.width = `${viewport.width}px`
    node.style.height = `${viewport.height}px`
  } catch (error) {
    console.warn('Failed to render text layer', error)
  }
}

function handleResize() {
  if (!pdfDoc) return
  cancelRenderTask()
  void renderCurrentPage()
}

function handleOverlayPointerDown(event: PointerEvent) {
  if (!currentViewport.value || textSelectMode.value || !overlayRef.value) return
  overlayRef.value.setPointerCapture(event.pointerId)
  overlayPointerId.value = event.pointerId
  const point = getRelativePoint(event)
  event.preventDefault()
  emit('overlay-pointer-down', {
    pointerId: event.pointerId,
    point,
    originalEvent: event,
  })
}

function handleOverlayPointerMove(event: PointerEvent) {
  if (overlayPointerId.value !== event.pointerId || !currentViewport.value) return
  const point = getRelativePoint(event)
  event.preventDefault()
  emit('overlay-pointer-move', {
    pointerId: event.pointerId,
    point,
    originalEvent: event,
  })
}

function handleOverlayPointerUp(event: PointerEvent) {
  if (overlayPointerId.value !== event.pointerId) return
  releasePointerCapture()
  const point = getRelativePoint(event)
  event.preventDefault()
  emit('overlay-pointer-up', {
    pointerId: event.pointerId,
    point,
    originalEvent: event,
  })
}

function handleOverlayPointerCancel(event: PointerEvent) {
  if (overlayPointerId.value !== event.pointerId) return
  releasePointerCapture()
  emit('overlay-pointer-cancel', { pointerId: event.pointerId })
}

function releasePointerCapture() {
  if (overlayPointerId.value !== null && overlayRef.value) {
    try {
      overlayRef.value.releasePointerCapture(overlayPointerId.value)
    } catch (error) {
      console.warn('Failed to release pointer capture', error)
    }
  }
  overlayPointerId.value = null
}

function handleTextSelectionEnd() {
  if (!textSelectMode.value || !textLayerRef.value || !currentViewport.value) return
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return
  const anchorNode = selection.anchorNode
  const focusNode = selection.focusNode
  const layer = textLayerRef.value
  if (!anchorNode || !focusNode) return
  if (!layer.contains(anchorNode) || !layer.contains(focusNode)) return

  const range = selection.rangeCount ? selection.getRangeAt(0) : null
  if (!range) return

  const rectList = range.getClientRects()
  if (!rectList.length) return

  const overlay = overlayRef.value
  if (!overlay) return
  const bounds = overlay.getBoundingClientRect()
  const overlayRects: OverlayPointRect[] = []
  for (const rect of Array.from(rectList)) {
    const x = clamp(rect.left - bounds.left, 0, currentViewport.value.width)
    const y = clamp(rect.top - bounds.top, 0, currentViewport.value.height)
    const width = clamp(rect.width, 0, currentViewport.value.width - x)
    const height = clamp(rect.height, 0, currentViewport.value.height - y)
    if (width > 1 && height > 1) {
      overlayRects.push({ x, y, width, height })
    }
  }
  if (!overlayRects.length) return

  const merged = mergeLineBoxes(overlayRects)
  const pdfRects: PdfRect[] = []
  for (const rect of merged) {
    const pdfRect = convertOverlayRectToPdf(rect)
    if (pdfRect) {
      pdfRects.push(pdfRect)
    }
  }
  if (!pdfRects.length) return

  emit('text-selection', { overlayRects: merged, pdfRects })
}

function mergeLineBoxes(boxes: OverlayPointRect[]): OverlayPointRect[] {
  const tolerance = 3
  const groups: OverlayPointRect[][] = []
  const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x)
  for (const box of sorted) {
    const group = groups.find((g) => {
      if (!g.length) return false
      return Math.abs(g[0]!.y - box.y) <= tolerance
    })
    if (group) {
      group.push(box)
    } else {
      groups.push([box])
    }
  }
  const merged: OverlayPointRect[] = []
  for (const group of groups) {
    if (!group.length) continue
    let current: OverlayPointRect = { ...group[0]! }
    for (let i = 1; i < group.length; i++) {
      const box = group[i]!
      if (box.x <= current.x + current.width + 4) {
        const right = Math.max(current.x + current.width, box.x + box.width)
        current.width = right - current.x
        current.y = Math.min(current.y, box.y)
        current.height = Math.max(current.height, box.height)
      } else {
        merged.push(current)
        current = { ...box }
      }
    }
    merged.push(current)
  }
  return merged
}

function convertOverlayRectToPdf(rect: OverlayPointRect): PdfRect | null {
  if (!currentViewport.value) return null
  const { scale, height } = currentViewport.value
  const width = rect.width / scale
  const heightPoints = rect.height / scale
  const x = rect.x / scale
  const y = (height - (rect.y + rect.height)) / scale
  return { x, y, width, height: heightPoints }
}

function getRelativePoint(event: PointerEvent): ViewerPoint {
  const overlay = overlayRef.value
  const viewport = currentViewport.value
  if (!overlay || !viewport) return { x: 0, y: 0 }
  const bounds = overlay.getBoundingClientRect()
  const x = clamp(event.clientX - bounds.left, 0, viewport.width)
  const y = clamp(event.clientY - bounds.top, 0, viewport.height)
  return { x, y }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function applyTextLayerViewportStyles(node: HTMLDivElement, viewport: PdfJsTypes.PageViewport) {
  const scale = viewport.scale
  node.style.setProperty('--scale-factor', `${scale}`)
  node.style.setProperty('--total-scale-factor', `${scale}`)
  node.style.setProperty('--user-unit', '1')
  if (typeof CSS !== 'undefined' && CSS.supports?.('width', 'round(10px, 1px)')) {
    node.style.setProperty('--scale-round-x', '0px')
    node.style.setProperty('--scale-round-y', '0px')
  } else {
    node.style.removeProperty('--scale-round-x')
    node.style.removeProperty('--scale-round-y')
  }
  node.setAttribute('data-main-rotation', `${viewport.rotation}`)
}

function applyTextLayerDebugStyles(node: HTMLDivElement) {
  const color = showRawTextLayer.value ? 'rgba(0, 0, 0, 0.85)' : 'transparent'
  node.style.setProperty('--pdf-text-layer-color', color)
  node.style.mixBlendMode = showRawTextLayer.value ? 'multiply' : ''
}
</script>

<style scoped>
.page-viewer {
  position: relative;
  display: inline-block;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  background: #fff;
}

.page-canvas {
  display: block;
  width: 100%;
  height: auto;
  position: relative;
  z-index: 0;
}

.page-overlay {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  touch-action: none;
}

.page-overlay.disabled {
  pointer-events: none;
  cursor: text;
  z-index: 2;
}

.overlay-rect {
  position: absolute;
  border: 2px solid rgba(244, 67, 54, 0.9);
  background-color: rgba(244, 67, 54, 0.35);
  border-radius: 2px;
}

.overlay-rect.drawing {
  border-style: dashed;
  background-color: rgba(244, 67, 54, 0.2);
}

.textLayer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  user-select: none;
  z-index: 1;
  line-height: 1;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  transform-origin: 0 0;
}

.textLayer.enabled {
  pointer-events: auto;
  user-select: text;
}

.textLayer :is(br) {
  -webkit-user-select: none;
}

.textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0 0;
}

.textLayer .endOfContent {
  display: block;
  position: absolute;
  left: 0;
  top: 0;
}

.textLayer ::selection {
  background: rgba(33, 150, 243, 0.25);
}
</style>
