import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import type * as PdfJsTypes from 'pdfjs-dist'
import * as pdfjsViewer from 'pdfjs-dist/web/pdf_viewer.mjs'
import type { PdfViewerEmit, PdfViewport, ViewportDimensions } from '../pdfViewerTypes'
import type { CanvasLoadedCallback } from '../pdfViewerTypes'
import { clamp } from '../utils/clamp'

type PDFDocumentProxy = PdfJsTypes.PDFDocumentProxy

const globalPdfjsNamespace = globalThis as unknown as { pdfjsLib?: typeof pdfjsLib }
if (!globalPdfjsNamespace.pdfjsLib) {
  globalPdfjsNamespace.pdfjsLib = pdfjsLib
}

export interface UsePdfPageRendererOptions {
  document: Ref<PdfJsTypes.PDFDocumentProxy | null | undefined>
  pageIndex: Ref<number>
  scale: Ref<number | null | undefined>
  minScale: Ref<number | undefined>
  maxScale: Ref<number | undefined>
  showTextLayer: Ref<boolean>
  afterCanvasLoaded: Ref<Record<number, CanvasLoadedCallback> | undefined>
  canvasRef: Ref<HTMLCanvasElement | null>
  viewerRef: Ref<HTMLDivElement | null>
  textLayerRef: Ref<HTMLDivElement | null>
  emit: PdfViewerEmit
}

export function usePdfPageRenderer({
  document,
  pageIndex,
  scale,
  minScale: minScaleProp,
  maxScale: maxScaleProp,
  showTextLayer,
  afterCanvasLoaded,
  canvasRef,
  viewerRef,
  textLayerRef,
  emit,
}: UsePdfPageRendererOptions) {
  const currentViewport = ref<PdfViewport | null>(null)
  const lastEmittedScale = ref<number | null>(null)

  const minScale = computed(() => minScaleProp.value ?? 0.5)
  const maxScale = computed(() => maxScaleProp.value ?? 4)
  const manualScale = computed(() => {
    const raw = scale.value
    if (raw === null || raw === undefined) return null
    const numeric = Number(raw)
    if (!Number.isFinite(numeric) || numeric <= 0) return null
    return clamp(numeric, minScale.value, maxScale.value)
  })

  let pdfDoc: PDFDocumentProxy | null = null
  let renderTask: ReturnType<PdfJsTypes.PDFPageProxy['render']> | null = null

  watch(
    () => document.value ?? null,
    async (nextDocument, previousDocument) => {
      if (nextDocument === previousDocument) return
      await setDocument(nextDocument)
    },
    { immediate: true }
  )

  watch(
    () => pageIndex.value,
    async (nextIndex, previousIndex) => {
      if (nextIndex === previousIndex) return
      await renderCurrentPage()
    }
  )

  watch(manualScale, async (nextScale, previousScale) => {
    if (nextScale === previousScale) return
    if (!pdfDoc) return
    cancelRenderTask()
    await renderCurrentPage()
  })

  watch(
    () => [minScale.value, maxScale.value],
    async ([nextMin, nextMax], [prevMin, prevMax]) => {
      if (prevMin === undefined && prevMax === undefined) return
      if (nextMin === prevMin && nextMax === prevMax) return
      if (!pdfDoc) return
      cancelRenderTask()
      await renderCurrentPage()
    }
  )

  watch(showTextLayer, async (enabled) => {
    if (!pdfDoc) return
    if (!enabled) {
      clearTextLayer()
      return
    }
    if (!currentViewport.value) return
    const targetIndex = clamp(pageIndex.value, 0, Math.max(pdfDoc.numPages - 1, 0))
    const pageNumber = targetIndex + 1
    try {
      const page = await pdfDoc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: currentViewport.value.scale })
      await nextTick()
      await renderTextLayer(page, viewport)
    } catch (error) {
      console.warn('Failed to render text layer after enabling', error)
    }
  })

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize, { passive: true })
    }
  })

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize)
    }
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
    lastEmittedScale.value = null

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
    const targetIndex = clamp(pageIndex.value, 0, Math.max(pdfDoc.numPages - 1, 0))
    const pageNumber = targetIndex + 1
    const page = await pdfDoc.getPage(pageNumber)
    const baseViewport = page.getViewport({ scale: 1 })
    await nextTick()

    const containerElement = viewerRef.value?.parentElement ?? viewerRef.value
    const containerWidth = containerElement?.clientWidth ?? baseViewport.width
    const autoScale = containerWidth ? containerWidth / baseViewport.width : 1
    const requestedScale = manualScale.value ?? autoScale
    const clampedScale = clamp(requestedScale, minScale.value, maxScale.value)
    const viewport = page.getViewport({ scale: clampedScale })
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
      invokeAfterCanvasLoaded(pageNumber, canvas, baseViewport)
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
      scale: clampedScale,
    }
    emit('rendered', { viewport: currentViewport.value })

    if (lastEmittedScale.value !== clampedScale) {
      lastEmittedScale.value = clampedScale
      emit('scale-change', { scale: clampedScale, isAuto: manualScale.value === null })
    }

    await nextTick()
    if (showTextLayer.value) {
      await renderTextLayer(page, viewport)
    } else {
      clearTextLayer()
    }
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
      const textLayer = new pdfjsViewer.TextLayerBuilder({ pdfPage: page })
      textLayer.div = node
      const textViewport = viewport.clone({ dontFlip: true })
      await textLayer.render({ viewport: textViewport })
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

  function clearTextLayer() {
    if (textLayerRef.value) {
      textLayerRef.value.innerHTML = ''
    }
  }

  function invokeAfterCanvasLoaded(
    pageNumber: number,
    canvasElement: HTMLCanvasElement,
    baseViewport: PdfJsTypes.PageViewport
  ) {
    const callbacks = afterCanvasLoaded.value
    if (!callbacks) return
    const callback = callbacks[pageNumber]
    if (!callback) return
    const baseWidth = baseViewport.width || 1
    const baseHeight = baseViewport.height || 1
    const dimensions: ViewportDimensions = {
      width: baseViewport.width,
      height: baseViewport.height,
      canvasWidth: canvasElement.width,
      canvasHeight: canvasElement.height,
      widthRatio: canvasElement.width / baseWidth,
      heightRatio: canvasElement.height / baseHeight,
    }
    try {
      callback(canvasElement, dimensions)
    } catch (error) {
      console.warn('afterCanvasLoaded callback failed', error)
    }
  }

  function applyTextLayerViewportStyles(node: HTMLDivElement, viewport: PdfJsTypes.PageViewport) {
    const scaleFactor = viewport.scale
    node.style.setProperty('--scale-factor', `${scaleFactor}`)
    node.style.setProperty('--total-scale-factor', `${scaleFactor}`)
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

  return {
    currentViewport,
    renderCurrentPage,
  }
}
