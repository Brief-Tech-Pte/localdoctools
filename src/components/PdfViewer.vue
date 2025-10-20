<template>
  <div
    ref="viewerRef"
    class="page-viewer"
    :class="{ pannable: canPan, 'is-panning': isPanning }"
    :style="viewerStyle"
  >
    <canvas ref="canvasRef" class="page-canvas" />
    <div
      v-if="currentViewport && showTextLayer"
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
      :class="{
        disabled: textSelectMode,
        pannable: canPan,
        dragging: isPanning,
      }"
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
import { computed, nextTick, ref, toRef, toRefs, watch } from 'vue'
import type { CSSProperties } from 'vue'
import type * as PdfJsTypes from 'pdfjs-dist'
import type {
  CanvasLoadedCallback,
  OverlayPointerPayload,
  PdfRect,
  PdfViewport,
  TextSelectionPayload,
  ViewerPoint,
  ViewerRect,
} from './pdfViewerTypes'
import { usePdfPageRenderer } from '../composables/usePdfPageRenderer'
import { clamp } from '../utils/clamp'

interface OverlayRectStyle {
  id: string
  style: Record<string, string>
}

const props = withDefaults(
  defineProps<{
    document?: PdfJsTypes.PDFDocumentProxy | null
    pageIndex: number
    textSelectMode: boolean
    overlayRects: OverlayRectStyle[]
    drawingRectStyle?: Record<string, string>
    showDrawingRect?: boolean
    minScale?: number
    maxScale?: number
    showTextLayer?: boolean
    afterCanvasLoaded?: Record<number, CanvasLoadedCallback>
    scale?: number | null
    enablePan?: boolean
  }>(),
  {
    showTextLayer: true,
    scale: null,
    enablePan: false,
  }
)

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
  (e: 'scale-change', payload: { scale: number; isAuto: boolean }): void
}>()

type OverlayPointRect = ViewerRect

const canvasRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLDivElement | null>(null)
const viewerRef = ref<HTMLDivElement | null>(null)
const textLayerRef = ref<HTMLDivElement | null>(null)
const panOffset = ref({ x: 0, y: 0 })
const panPointerOrigin = ref({ x: 0, y: 0 })
const panOffsetOrigin = ref({ x: 0, y: 0 })
const panBounds = ref({ minX: 0, maxX: 0, minY: 0, maxY: 0 })
const isPanning = ref(false)

const { textSelectMode, overlayRects, drawingRectStyle, showDrawingRect, showTextLayer } =
  toRefs(props)
const enablePan = toRef(props, 'enablePan')
const documentRef = toRef(props, 'document')
const pageIndexRef = toRef(props, 'pageIndex')
const scaleRef = toRef(props, 'scale')
const minScaleRef = toRef(props, 'minScale')
const maxScaleRef = toRef(props, 'maxScale')
const afterCanvasLoadedRef = toRef(props, 'afterCanvasLoaded')

const { currentViewport } = usePdfPageRenderer({
  document: documentRef,
  pageIndex: pageIndexRef,
  scale: scaleRef,
  minScale: minScaleRef,
  maxScale: maxScaleRef,
  showTextLayer,
  afterCanvasLoaded: afterCanvasLoadedRef,
  canvasRef,
  viewerRef,
  textLayerRef,
  emit,
})

const overlayPointerId = ref<number | null>(null)

const canPan = computed(() => enablePan.value && !textSelectMode.value)
const viewerStyle = computed<CSSProperties>(() => {
  const { x, y } = panOffset.value
  return {
    transform: `translate3d(${x}px, ${y}px, 0)`,
  }
})

watch(canPan, (enabled) => {
  if (!enabled) {
    stopPan()
  }
})

watch(
  currentViewport,
  (viewport) => {
    if (!viewport) {
      stopPan()
      panBounds.value = { minX: 0, maxX: 0, minY: 0, maxY: 0 }
      setPanOffset(0, 0)
      return
    }
    void nextTick().then(() => {
      updatePanBounds()
    })
  },
  { flush: 'post' }
)

function handleOverlayPointerDown(event: PointerEvent) {
  if (!currentViewport.value || !overlayRef.value) return
  const panIntent = shouldPan(event)
  if (textSelectMode.value && !panIntent) return
  overlayRef.value.setPointerCapture(event.pointerId)
  overlayPointerId.value = event.pointerId
  if (panIntent) {
    startPan(event)
    event.preventDefault()
    return
  }
  if (textSelectMode.value) return
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
  if (isPanning.value) {
    event.preventDefault()
    updatePan(event)
    return
  }
  if (textSelectMode.value) return
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
  if (isPanning.value) {
    event.preventDefault()
    endPan()
    releasePointerCapture()
    return
  }
  releasePointerCapture()
  if (textSelectMode.value) return
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
  const wasPanning = isPanning.value
  if (wasPanning) {
    endPan()
    event.preventDefault()
  }
  releasePointerCapture()
  if (wasPanning) return
  emit('overlay-pointer-cancel', { pointerId: event.pointerId })
}

function shouldPan(event?: PointerEvent) {
  if (!canPan.value) return false
  if (!event) return true
  if (event.pointerType === 'touch' || event.pointerType === 'pen') return true
  if (typeof event.buttons === 'number') {
    return (event.buttons & 1) === 1
  }
  return event.button === 0
}

function startPan(event: PointerEvent) {
  isPanning.value = true
  panPointerOrigin.value = { x: event.clientX, y: event.clientY }
  panOffsetOrigin.value = { ...panOffset.value }
}

function updatePan(event: PointerEvent) {
  const deltaX = event.clientX - panPointerOrigin.value.x
  const deltaY = event.clientY - panPointerOrigin.value.y
  setPanOffset(panOffsetOrigin.value.x + deltaX, panOffsetOrigin.value.y + deltaY)
}

function endPan() {
  if (!isPanning.value) return
  isPanning.value = false
  setPanOffset(panOffset.value.x, panOffset.value.y)
}

function stopPan() {
  if (!isPanning.value) return
  isPanning.value = false
  releasePointerCapture()
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

function setPanOffset(x: number, y: number) {
  const { minX, maxX, minY, maxY } = panBounds.value
  const clampedX = clamp(x, minX, maxX)
  const clampedY = clamp(y, minY, maxY)
  if (panOffset.value.x === clampedX && panOffset.value.y === clampedY) return
  panOffset.value = { x: clampedX, y: clampedY }
}

function updatePanBounds() {
  const viewport = currentViewport.value
  if (!viewport) {
    panBounds.value = { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    setPanOffset(0, 0)
    return
  }
  const containerElement = viewerRef.value?.parentElement ?? viewerRef.value
  if (!containerElement) return
  const containerWidth = containerElement.clientWidth || viewport.width
  const containerHeight = containerElement.clientHeight || viewport.height
  let horizontalPadding = 0
  let verticalPadding = 0
  if (typeof window !== 'undefined') {
    const styles = window.getComputedStyle(containerElement)
    const paddingLeft = parseFloat(styles.paddingLeft || '0')
    const paddingRight = parseFloat(styles.paddingRight || '0')
    const paddingTop = parseFloat(styles.paddingTop || '0')
    const paddingBottom = parseFloat(styles.paddingBottom || '0')
    if (Number.isFinite(paddingLeft) && Number.isFinite(paddingRight)) {
      horizontalPadding = paddingLeft + paddingRight
    }
    if (Number.isFinite(paddingTop) && Number.isFinite(paddingBottom)) {
      verticalPadding = paddingTop + paddingBottom
    }
  }
  const usableWidth = Math.max(containerWidth - horizontalPadding, 0)
  const usableHeight = Math.max(containerHeight - verticalPadding, 0)
  const overflowX = Math.max(viewport.width - usableWidth, 0)
  const overflowY = Math.max(viewport.height - usableHeight, 0)
  const horizontalRange = overflowX / 2
  const verticalRange = overflowY
  panBounds.value = {
    minX: -horizontalRange,
    maxX: horizontalRange,
    minY: -verticalRange,
    maxY: 0,
  }
  setPanOffset(panOffset.value.x, panOffset.value.y)
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
</script>

<style scoped>
.page-viewer {
  position: relative;
  display: inline-block;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  background: #fff;
  will-change: transform;
}

.page-viewer.pannable {
  cursor: grab;
}

.page-viewer.pannable.is-panning {
  cursor: grabbing;
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
  user-select: none;
}

.page-overlay.disabled {
  pointer-events: none;
  cursor: text;
  z-index: 2;
}

.page-overlay.pannable {
  cursor: grab;
}

.page-overlay.pannable.dragging {
  cursor: grabbing;
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
  user-select: none;
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
