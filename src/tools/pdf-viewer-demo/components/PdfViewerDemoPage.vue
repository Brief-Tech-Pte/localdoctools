<template>
  <q-page class="q-pa-lg">
    <div class="row q-col-gutter-lg">
      <div class="col-12 col-md-4">
        <q-card bordered>
          <q-card-section>
            <div class="text-h6">PDF Viewer Demo</div>
            <div class="text-caption text-grey-7">
              Load any PDF by URL (data URLs included) to exercise the shared viewer component.
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section class="column q-gutter-md">
            <div class="row items-end q-col-gutter-sm">
              <div class="col">
                <q-input
                  v-model="urlInput"
                  label="PDF URL"
                  type="text"
                  dense
                  outlined
                  autocomplete="off"
                  aria-label="PDF URL"
                />
              </div>
              <div class="col-auto">
                <q-btn
                  :loading="loading"
                  color="primary"
                  label="Load URL"
                  unelevated
                  @click="loadPdfFromUrl"
                />
              </div>
            </div>
            <div class="row q-col-gutter-sm">
              <div class="col-auto">
                <q-btn outline icon="upload_file" label="Load Local PDF" @click="triggerFileDialog" />
              </div>
              <div class="col-auto">
                <q-btn
                  flat
                  label="Reset overlays"
                  :disable="!overlayRectsInternal.length"
                  @click="clearOverlays"
                />
              </div>
              <div class="col-auto">
                <q-btn
                  flat
                  label="Toggle text layer overlay"
                  :disable="!hasDocument"
                  :class="{ 'text-primary': showRawTextLayer }"
                  @click="toggleTextLayerDebug"
                />
              </div>
            </div>
            <div class="text-caption text-grey-6">
              Text selection is always enabled; highlight copyable text to capture overlay rectangles.
            </div>
            <div v-if="statusMessage" class="text-body2">{{ statusMessage }}</div>
            <input
              ref="fileInputRef"
              type="file"
              accept="application/pdf"
              class="hidden-input"
              @change="handleFileChange"
            />
            <div v-if="error" class="text-negative">{{ error }}</div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div class="row items-center no-wrap q-gutter-sm">
              <q-btn
                icon="chevron_left"
                flat
                round
                dense
                :disable="!canGoPrevious"
                @click="goPrevious"
              />
              <q-input
                v-model.number="pageInput"
                type="number"
                min="1"
                :max="totalPages"
                label="Page"
                dense
                filled
                class="page-input"
              />
              <q-btn
                icon="chevron_right"
                flat
                round
                dense
                :disable="!canGoNext"
                @click="goNext"
              />
              <div class="text-caption text-grey-7">
                {{ activePageDisplay }} / {{ totalPages }}
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-8">
        <q-card bordered>
          <q-card-section class="row items-center justify-between">
            <div class="text-subtitle1">Viewer</div>
            <div class="text-caption text-grey-7" v-if="hasDocument">
              {{ activePageDisplay }} / {{ totalPages }} · {{ currentViewportText }}
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div v-if="viewerActive" class="viewer-wrapper">
              <PdfViewer
                :src="viewerSrc"
                :page-index="pageIndex"
                :text-select-mode="textSelectMode"
                :show-raw-text-layer="showRawTextLayer"
                :overlay-rects="overlayRects"
                :drawing-rect-style="drawingRectStyle"
                :show-drawing-rect="showDrawingRect"
                :disable-auto-fetch="true"
                :disable-stream="true"
                @document-loaded="onDocumentLoaded"
                @document-unloaded="onDocumentUnloaded"
                @rendered="onRendered"
                @load-error="onLoadError"
                @render-error="onRenderError"
                @overlay-pointer-down="onOverlayPointerDown"
                @overlay-pointer-move="onOverlayPointerMove"
                @overlay-pointer-up="onOverlayPointerUp"
                @overlay-pointer-cancel="onOverlayPointerCancel"
              />
            </div>
            <div v-else class="text-grey-6">
              Enter a URL and click “Load PDF” to render it here. The default demo document is
              <code>/samples/demo.pdf</code>.
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import PdfViewer from 'src/components/PdfViewer.vue'
import type {
  OverlayPointerPayload,
  PdfViewport,
  ViewerPoint,
  ViewerRect,
} from 'src/components/pdfViewerTypes'

interface OverlayRectEntry {
  id: string
  rect: ViewerRect
}

const defaultPdfUrl = '/samples/demo.pdf'

const urlInput = ref(defaultPdfUrl)
const viewerSrc = ref<string | Blob | null>(defaultPdfUrl)
const loading = ref(false)
const error = ref('')
const statusMessage = ref('')
const pageIndex = ref(0)
const pageCount = ref(0)
const currentViewport = ref<PdfViewport | null>(null)
const textSelectMode = ref(true)
const showRawTextLayer = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const overlayRectsInternal = ref<OverlayRectEntry[]>([])
const drawingPointerId = ref<number | null>(null)
const pointerOrigin = ref<ViewerPoint | null>(null)
const drawingRect = ref<ViewerRect | null>(null)

const overlayRects = computed(() => {
  return overlayRectsInternal.value.map((entry) => ({
    id: entry.id,
    style: rectToStyle(entry.rect),
  }))
})

const drawingRectStyle = computed(() => (drawingRect.value ? rectToStyle(drawingRect.value) : {}))
const showDrawingRect = computed(() => Boolean(drawingRect.value))

const totalPages = computed(() => (pageCount.value ? pageCount.value : 0))
const activePageDisplay = computed(() => (pageCount.value ? pageIndex.value + 1 : 0))
const canGoPrevious = computed(() => pageCount.value > 0 && pageIndex.value > 0)
const canGoNext = computed(() => pageCount.value > 0 && pageIndex.value < pageCount.value - 1)
const currentViewportText = computed(() => {
  if (!currentViewport.value) return ''
  const { width, height, scale } = currentViewport.value
  const rounded = (value: number) => Math.round(value)
  return `${rounded(width)}×${rounded(height)} @ ${scale.toFixed(2)}×`
})

const hasDocument = computed(() => pageCount.value > 0)
const viewerActive = computed(() => Boolean(viewerSrc.value))

const pageInput = computed({
  get: () => activePageDisplay.value || 1,
  set: (value: number | string) => {
    if (!pageCount.value) return
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return
    pageIndex.value = clamp(Math.round(numeric) - 1, 0, pageCount.value - 1)
  },
})

onMounted(() => {
  void loadPdfFromUrl()
})

async function loadPdfFromUrl() {
  const targetUrl = urlInput.value.trim()
  if (!targetUrl) {
    error.value = 'Enter a PDF URL to load.'
    return
  }
  loading.value = true
  error.value = ''
  statusMessage.value = 'Loading PDF (linearized streams will use range requests when available)…'
  prepareForReload()
  if (viewerSrc.value === targetUrl) {
    viewerSrc.value = null
    await nextTick()
  }
  viewerSrc.value = targetUrl
}

function prepareForReload() {
  overlayRectsInternal.value = []
  drawingRect.value = null
  drawingPointerId.value = null
  pointerOrigin.value = null
  pageIndex.value = 0
  pageCount.value = 0
  currentViewport.value = null
}

function clearOverlays() {
  overlayRectsInternal.value = []
  statusMessage.value = 'Cleared overlay rectangles.'
}

function triggerFileDialog() {
  fileInputRef.value?.click()
}

function toggleTextLayerDebug() {
  showRawTextLayer.value = !showRawTextLayer.value
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0] ?? null
  if (!file) {
    return
  }
  loading.value = true
  error.value = ''
  statusMessage.value = `Loading local file "${file.name}"…`
  prepareForReload()
  try {
    const arrayBuffer = await file.arrayBuffer()
    viewerSrc.value = new Blob([arrayBuffer], { type: file.type || 'application/pdf' })
    urlInput.value = ''
  } catch (loadError) {
    console.error(loadError)
    error.value = 'Failed to read the selected file.'
    loading.value = false
    statusMessage.value = ''
    viewerSrc.value = null
  } finally {
    if (target) {
      target.value = ''
    }
  }
}

function goPrevious() {
  if (canGoPrevious.value) {
    pageIndex.value -= 1
  }
}

function goNext() {
  if (canGoNext.value) {
    pageIndex.value += 1
  }
}

function onDocumentLoaded(payload: { pageCount: number }) {
  pageCount.value = payload.pageCount
  pageIndex.value = 0
  loading.value = false
  statusMessage.value = `Loaded document with ${payload.pageCount} page(s).`
}

function onDocumentUnloaded() {
  pageCount.value = 0
  pageIndex.value = 0
  currentViewport.value = null
  if (!viewerActive.value) {
    statusMessage.value = ''
  }
}

function onRendered(payload: { viewport: PdfViewport }) {
  currentViewport.value = payload.viewport
}

function onLoadError(payload: { error: unknown }) {
  console.error(payload.error)
  loading.value = false
  error.value = 'Viewer failed to load the PDF.'
}

function onRenderError(payload: { error: unknown }) {
  console.error(payload.error)
  error.value = 'Unable to render the current page.'
}

function onOverlayPointerDown(payload: OverlayPointerPayload) {
  drawingPointerId.value = payload.pointerId
  pointerOrigin.value = payload.point
  drawingRect.value = {
    x: payload.point.x,
    y: payload.point.y,
    width: 0,
    height: 0,
  }
}

function onOverlayPointerMove(payload: OverlayPointerPayload) {
  if (drawingPointerId.value !== payload.pointerId || !pointerOrigin.value) return
  drawingRect.value = normalizeRect(pointerOrigin.value, payload.point)
}

function onOverlayPointerUp(payload: OverlayPointerPayload) {
  if (drawingPointerId.value !== payload.pointerId) return
  finalizeDrawing(true, payload.point)
}

function onOverlayPointerCancel(payload: { pointerId: number }) {
  if (drawingPointerId.value !== payload.pointerId) return
  finalizeDrawing(false)
}

function finalizeDrawing(shouldPersist: boolean, endPoint?: ViewerPoint) {
  if (shouldPersist && pointerOrigin.value && endPoint) {
    const rect = normalizeRect(pointerOrigin.value, endPoint)
    if (rect.width >= 4 && rect.height >= 4) {
      overlayRectsInternal.value = [
        ...overlayRectsInternal.value,
        { id: crypto.randomUUID(), rect },
      ]
    }
  }
  drawingPointerId.value = null
  pointerOrigin.value = null
  drawingRect.value = null
}

function rectToStyle(rect: ViewerRect) {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
}

function normalizeRect(
  origin: ViewerPoint,
  point: ViewerPoint
): ViewerRect {
  const left = Math.min(origin.x, point.x)
  const top = Math.min(origin.y, point.y)
  const width = Math.abs(point.x - origin.x)
  const height = Math.abs(point.y - origin.y)
  return { x: left, y: top, width, height }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
</script>

<style scoped>
.viewer-wrapper {
  border: 1px solid var(--q-primary);
  border-radius: 4px;
  background: #fafafa;
  padding: 16px;
  display: flex;
  justify-content: center;
  overflow: hidden;
  max-height: 720px;
}

.page-input {
  min-width: 96px;
}

.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  border: 0;
  clip: rect(0, 0, 0, 0);
  overflow: hidden;
}
</style>
