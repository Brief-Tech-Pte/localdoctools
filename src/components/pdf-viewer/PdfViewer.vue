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
import { ref, toRef, toRefs } from 'vue'
import type * as PdfJsTypes from 'pdfjs-dist'
import type {
  CanvasLoadedCallback,
  OverlayPointerPayload,
  PdfViewport,
  TextSelectionPayload,
} from './pdfViewerTypes'
import { usePdfPageRenderer } from './composables/usePdfPageRenderer'
import { usePdfOverlayPan } from './composables/usePdfOverlayPan'
import { useTextSelectionBridge } from './composables/useTextSelectionBridge'

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

const canvasRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLDivElement | null>(null)
const viewerRef = ref<HTMLDivElement | null>(null)
const textLayerRef = ref<HTMLDivElement | null>(null)

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

const {
  canPan,
  viewerStyle,
  isPanning,
  handleOverlayPointerDown,
  handleOverlayPointerMove,
  handleOverlayPointerUp,
  handleOverlayPointerCancel,
} = usePdfOverlayPan({
  overlayRef,
  viewerRef,
  currentViewport,
  enablePan,
  textSelectMode,
  emit,
})

const { handleTextSelectionEnd: handleTextSelectionEndInternal } = useTextSelectionBridge({
  overlayRef,
  textLayerRef,
  currentViewport,
  textSelectMode,
})

function handleTextSelectionEnd() {
  handleTextSelectionEndInternal(({ overlayRects, pdfRects }) => {
    emit('text-selection', { overlayRects, pdfRects })
  })
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
