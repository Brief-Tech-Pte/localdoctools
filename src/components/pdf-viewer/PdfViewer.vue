<template>
  <q-card bordered class="pdf-viewer-shell">
    <q-toolbar class="pdf-viewer-shell__toolbar" dense>
      <q-btn-group flat dense>
        <q-btn
          icon="first_page"
          flat
          round
          dense
          :disable="!canGoPrevious"
          aria-label="Go to first page"
          @click="goFirst"
        />
        <q-btn
          icon="chevron_left"
          flat
          round
          dense
          :disable="!canGoPrevious"
          aria-label="Go to previous page"
          @click="goPrevious"
        />
        <q-input
          v-model.number="pageInput"
          type="number"
          min="1"
          :max="pageCount"
          dense
          filled
          class="q-ml-md no-spin"
          :suffix="' / ' + pageCount"
        ></q-input>
        <q-btn
          icon="chevron_right"
          flat
          round
          dense
          :disable="!canGoNext"
          aria-label="Go to next page"
          @click="goNext"
        />
        <q-btn
          icon="last_page"
          flat
          round
          dense
          :disable="!canGoNext"
          aria-label="Go to last page"
          @click="goLast"
        />
      </q-btn-group>

      <slot name="toolbar-start" />

      <slot name="toolbar-end">
        <q-btn
          dense
          flat
          round
          :icon="textSelectIcon"
          :color="currentTextSelectMode ? 'primary' : 'grey-6'"
          :unelevated="currentTextSelectMode"
          aria-label="Toggle text selection"
          @click="toggleTextSelectMode"
        >
          <q-tooltip>{{ currentTextSelectMode ? 'Selection Enabled' : 'Pan Overlay' }}</q-tooltip>
        </q-btn>

        <q-separator vertical inset spaced />
      </slot>

      <q-btn
        icon="zoom_out"
        flat
        round
        dense
        :disable="!canZoomOut"
        aria-label="Zoom out"
        @click="zoomOut"
      />
      <q-btn flat dense :disable="!hasDocument">
        {{ zoomDisplayValue }}
        <q-icon name="arrow_drop_down" size="16px" class="q-ml-xs" />
        <q-menu anchor="bottom left" self="top left">
          <q-list class="pdf-viewer-shell__zoom-menu" padding>
            <template v-for="option in zoomOptions" :key="option.label">
              <q-separator v-if="option.separator" spaced />
              <q-item
                v-else
                clickable
                v-close-popup
                dense
                :active="isZoomOptionActive(option)"
                @click="handleZoomOptionClick(option.value)"
              >
                <q-item-section>{{ option.label }}</q-item-section>
              </q-item>
            </template>
          </q-list>
        </q-menu>
      </q-btn>
      <q-btn
        icon="zoom_in"
        flat
        round
        dense
        :disable="!canZoomIn"
        aria-label="Zoom in"
        @click="zoomIn"
      />
    </q-toolbar>

    <q-separator />

    <q-card-section class="pdf-viewer-shell__stage">
      <div v-if="hasDocument" class="pdf-viewer-shell__canvas">
        <PdfRender
          :document="document"
          :page-index="currentPageIndex"
          :text-select-mode="currentTextSelectMode"
          :enable-pan="resolvedEnablePan && !currentTextSelectMode"
          :scale="manualScale"
          :min-scale="minScale"
          :max-scale="maxScale"
          :overlay-rects="overlayRects"
          :show-drawing-rect="showDrawingRect"
          :drawing-rect-style="resolvedDrawingRectStyle"
          :after-canvas-loaded="resolvedAfterCanvasLoaded"
          :show-text-layer="showTextLayer"
          @document-loaded="handleDocumentLoaded"
          @document-unloaded="handleDocumentUnloaded"
          @rendered="handleRendered"
          @load-error="handleLoadError"
          @render-error="handleRenderError"
          @overlay-pointer-down="handleOverlayPointerDown"
          @overlay-pointer-move="handleOverlayPointerMove"
          @overlay-pointer-up="handleOverlayPointerUp"
          @overlay-pointer-cancel="handleOverlayPointerCancel"
          @text-selection="handleTextSelection"
          @scale-change="handleScaleChange"
        />
      </div>
      <div v-else class="pdf-viewer-shell__empty text-grey-6">
        <slot name="empty">{{ emptyStateMessage }}</slot>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type * as PdfJsTypes from 'pdfjs-dist'
import PdfRender from './PdfRender.vue'
import type {
  CanvasLoadedCallback,
  OverlayPointerPayload,
  PdfViewport,
  TextSelectionPayload,
} from './pdfViewerTypes'
import { clamp } from './utils/clamp'

interface OverlayRectStyle {
  id: string
  style: Record<string, string>
}

type ZoomOption = { label: string; value?: string | number; separator?: boolean }

const props = withDefaults(
  defineProps<{
    document: PdfJsTypes.PDFDocumentProxy | null
    overlayRects?: OverlayRectStyle[]
    drawingRectStyle?: Record<string, string>
    showDrawingRect?: boolean
    minScale?: number
    maxScale?: number
    zoomStep?: number
    showTextLayer?: boolean
    enablePan?: boolean
    afterCanvasLoaded?: Record<number, CanvasLoadedCallback>
    pageIndex?: number
    textSelectMode?: boolean
    emptyStateMessage?: string
  }>(),
  {
    overlayRects: () => [],
    showDrawingRect: false,
    minScale: 0.5,
    maxScale: 4,
    zoomStep: 0.1,
    showTextLayer: true,
    textSelectMode: true,
    enablePan: true,
    emptyStateMessage: 'Select a PDF document to preview it here.',
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
  (e: 'update:page-index', value: number): void
  (e: 'update:text-select-mode', value: boolean): void
}>()

const internalPageIndex = ref(props.pageIndex ?? 0)
const pageCount = ref(0)
const manualScale = ref<number | null>(null)
const effectiveScale = ref(1)
const internalTextSelectMode = ref(props.textSelectMode ?? true)
const currentViewport = ref<PdfViewport | null>(null)

const minScale = computed(() => props.minScale)
const maxScale = computed(() => props.maxScale)
const zoomStep = computed(() => props.zoomStep)
const showTextLayer = computed(() => props.showTextLayer)
const overlayRects = computed(() => props.overlayRects)
const showDrawingRect = computed(() => props.showDrawingRect)
const resolvedDrawingRectStyle = computed<Record<string, string>>(
  () => props.drawingRectStyle ?? {}
)
const resolvedAfterCanvasLoaded = computed<Record<number, CanvasLoadedCallback>>(
  () => props.afterCanvasLoaded ?? {}
)
const resolvedEnablePan = computed(() => props.enablePan)

const hasDocument = computed(() => Boolean(props.document))

const isPageIndexControlled = computed(() => props.pageIndex !== undefined)
const isTextSelectControlled = computed(() => props.textSelectMode !== undefined)

const currentPageIndex = computed(() =>
  isPageIndexControlled.value ? (props.pageIndex ?? 0) : internalPageIndex.value
)

const currentTextSelectMode = computed(() =>
  isTextSelectControlled.value ? (props.textSelectMode ?? true) : internalTextSelectMode.value
)

const activePageDisplay = computed(() => (pageCount.value ? currentPageIndex.value + 1 : 0))

const canGoPrevious = computed(() => pageCount.value > 0 && currentPageIndex.value > 0)
const canGoNext = computed(
  () => pageCount.value > 0 && currentPageIndex.value < pageCount.value - 1
)

const textSelectIcon = computed(() => (currentTextSelectMode.value ? 'text_fields' : 'pan_tool'))

const zoomPresetValues = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const

const zoomBaseline = computed(() => manualScale.value ?? effectiveScale.value)
const canZoomIn = computed(() => zoomBaseline.value < maxScale.value - 0.001)
const canZoomOut = computed(() => zoomBaseline.value > minScale.value + 0.001)

const zoomOptions = computed<ZoomOption[]>(() => {
  const options: ZoomOption[] = [
    { label: 'Actual Size', value: 'actual' },
    { label: 'Page Width', value: 'page-width' },
    { separator: true, label: 'separator' },
  ]
  for (const preset of zoomPresetValues) {
    options.push({
      label: `${Math.round(preset * 100)}%`,
      value: preset,
    })
  }
  const currentScale = manualScale.value
  if (currentScale !== null) {
    const alreadyIncluded =
      approxEquals(currentScale, 1) ||
      zoomPresetValues.some((preset) => approxEquals(preset, currentScale))
    if (!alreadyIncluded) {
      options.push({
        label: `${Math.round(currentScale * 100)}%`,
        value: currentScale,
      })
    }
  }
  return options
})

const zoomSelectValue = computed<string | number>(() => {
  if (manualScale.value === null) {
    return 'page-width'
  }
  if (approxEquals(manualScale.value, 1)) {
    return 'actual'
  }
  const presetMatch = zoomPresetValues.find((preset) =>
    approxEquals(preset, manualScale.value as number)
  )
  if (presetMatch !== undefined) {
    return presetMatch
  }
  return manualScale.value
})

const zoomDisplayValue = computed(() => `${Math.round(effectiveScale.value * 100)}%`)

const pageInput = computed({
  get: () => (pageCount.value ? activePageDisplay.value : 0),
  set: (value: number | string) => {
    if (!pageCount.value) return
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return
    updatePageIndex(clamp(Math.round(numeric) - 1, 0, pageCount.value - 1))
  },
})

watch(
  () => props.document,
  (doc) => {
    if (!doc) {
      resetState()
    }
  }
)

watch(
  () => props.pageIndex,
  (value) => {
    if (value !== undefined) {
      internalPageIndex.value = value
    }
  }
)

watch(
  () => props.textSelectMode,
  (value) => {
    if (value !== undefined) {
      internalTextSelectMode.value = value
    }
  }
)

function updatePageIndex(value: number) {
  if (isPageIndexControlled.value) {
    emit('update:page-index', value)
  } else {
    internalPageIndex.value = value
  }
}

function updateTextSelectMode(value: boolean) {
  if (isTextSelectControlled.value) {
    emit('update:text-select-mode', value)
  } else {
    internalTextSelectMode.value = value
  }
}

function goPrevious() {
  if (canGoPrevious.value) {
    updatePageIndex(currentPageIndex.value - 1)
  }
}

function goNext() {
  if (canGoNext.value) {
    updatePageIndex(currentPageIndex.value + 1)
  }
}

function goFirst() {
  if (canGoPrevious.value) {
    updatePageIndex(0)
  }
}

function goLast() {
  if (canGoNext.value) {
    updatePageIndex(pageCount.value - 1)
  }
}

function toggleTextSelectMode() {
  updateTextSelectMode(!currentTextSelectMode.value)
}

function zoomIn() {
  if (!canZoomIn.value) return
  const next = clamp(zoomBaseline.value + zoomStep.value, minScale.value, maxScale.value)
  manualScale.value = next
}

function zoomOut() {
  if (!canZoomOut.value) return
  const next = clamp(zoomBaseline.value - zoomStep.value, minScale.value, maxScale.value)
  manualScale.value = next
}

function applyZoomValue(value: string | number) {
  if (value === 'page-width') {
    manualScale.value = null
  } else if (value === 'actual') {
    manualScale.value = 1
  } else if (typeof value === 'number') {
    manualScale.value = clamp(value, minScale.value, maxScale.value)
  }
}

function handleZoomOptionClick(value?: string | number) {
  if (value === undefined) return
  applyZoomValue(value)
}

function isZoomOptionActive(option: ZoomOption) {
  if (option.separator || option.value === undefined) return false
  const current = zoomSelectValue.value
  if (typeof option.value === 'number' && typeof current === 'number') {
    return approxEquals(option.value, current)
  }
  return option.value === current
}

function handleDocumentLoaded(payload: { pageCount: number }) {
  pageCount.value = payload.pageCount
  updatePageIndex(0)
  emit('document-loaded', payload)
}

function handleDocumentUnloaded() {
  emit('document-unloaded')
  resetState()
}

function handleRendered(payload: { viewport: PdfViewport }) {
  currentViewport.value = payload.viewport
  emit('rendered', payload)
}

function handleScaleChange(payload: { scale: number; isAuto: boolean }) {
  effectiveScale.value = payload.scale
  if (payload.isAuto && manualScale.value !== null) {
    manualScale.value = null
  }
  emit('scale-change', payload)
}

function handleLoadError(payload: { error: unknown }) {
  emit('load-error', payload)
}

function handleRenderError(payload: { error: unknown }) {
  emit('render-error', payload)
}

function handleOverlayPointerDown(payload: OverlayPointerPayload) {
  emit('overlay-pointer-down', payload)
}

function handleOverlayPointerMove(payload: OverlayPointerPayload) {
  emit('overlay-pointer-move', payload)
}

function handleOverlayPointerUp(payload: OverlayPointerPayload) {
  emit('overlay-pointer-up', payload)
}

function handleOverlayPointerCancel(payload: { pointerId: number }) {
  emit('overlay-pointer-cancel', payload)
}

function handleTextSelection(payload: TextSelectionPayload) {
  emit('text-selection', payload)
}

function resetState() {
  if (!isPageIndexControlled.value) {
    internalPageIndex.value = 0
  }
  if (!isTextSelectControlled.value) {
    internalTextSelectMode.value = props.textSelectMode ?? true
  }
  pageCount.value = 0
  manualScale.value = null
  effectiveScale.value = 1
  currentViewport.value = null
}

function approxEquals(a: number, b: number) {
  return Math.abs(a - b) < 0.001
}
</script>

<style scoped>
.pdf-viewer-shell__zoom-menu {
  min-width: 140px;
}

.pdf-viewer-shell__stage {
  background: var(--q-grey-1);
}

.pdf-viewer-shell__canvas {
  background: #f3f6fb;
  border: 1px solid var(--q-grey-4);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
  display: flex;
  justify-content: center;
  overflow: auto;
  min-height: 420px;
}

.pdf-viewer-shell__empty {
  padding: 48px 16px;
  text-align: center;
}

/* Chrome, Safari, Edge, Opera */
.no-spin ::-webkit-outer-spin-button,
.no-spin ::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
.no-spin[type='number'],
.no-spin input[type='number'] {
  -moz-appearance: textfield;
}
</style>
