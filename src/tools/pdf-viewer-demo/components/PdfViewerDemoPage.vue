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
            </div>
            <div class="text-caption text-grey-6">
              Text selection is enabled so you can copy text directly from the PDF.
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
        </q-card>
      </div>

      <div class="col-12 col-md-8">
        <q-card bordered>
          <q-card-section class="row items-center justify-between">
            <div class="text-subtitle1">Viewer</div>
            <div class="text-caption text-grey-7" v-if="hasDocument">
              {{ activePageDisplay }} / {{ totalPages }} · {{ currentViewportText }} · {{ scaleDisplay }}
            </div>
          </q-card-section>
          <q-separator v-if="hasDocument" />
          <q-card-section v-if="hasDocument">
            <div class="viewer-controls row items-center no-wrap q-gutter-sm">
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
              <q-separator vertical class="q-mx-sm viewer-controls__divider" />
              <q-btn
                :icon="textSelectIcon"
                :color="textSelectMode ? 'primary' : 'grey-7'"
                :flat="!textSelectMode"
                :unelevated="textSelectMode"
                dense
                class="q-px-sm"
                @click="toggleTextSelectMode"
              >
                {{ textSelectMode ? 'Selection' : 'Pan Overlay' }}
              </q-btn>
              <q-separator vertical class="q-mx-sm viewer-controls__divider" />
              <q-btn
                icon="zoom_out"
                flat
                round
                dense
                :disable="!canZoomOut"
                aria-label="Zoom out"
                @click="zoomOut"
              />
              <div class="zoom-display text-caption text-weight-medium">
                {{ scaleDisplay }}
              </div>
              <q-btn
                icon="zoom_in"
                flat
                round
                dense
                :disable="!canZoomIn"
                aria-label="Zoom in"
                @click="zoomIn"
              />
              <q-btn
                icon="fit_screen"
                dense
                :color="isAutoScale ? 'primary' : 'grey-7'"
                :flat="!isAutoScale"
                :unelevated="isAutoScale"
                aria-label="Fit to width"
                @click="resetZoom"
              />
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div v-if="viewerActive" class="viewer-wrapper">
              <PdfViewer
                :document="viewerDocument"
                :page-index="pageIndex"
                :text-select-mode="textSelectMode"
                :scale="manualScale"
                :min-scale="minScale"
                :max-scale="maxScale"
                :overlay-rects="emptyOverlayRects"
                :show-drawing-rect="false"
                @document-loaded="onDocumentLoaded"
                @document-unloaded="onDocumentUnloaded"
                @rendered="onRendered"
                @load-error="onLoadError"
                @render-error="onRenderError"
                @scale-change="onScaleChange"
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import PdfViewer from 'src/components/PdfViewer.vue'
import type { PdfViewport } from 'src/components/pdfViewerTypes'
import type * as PdfJsTypes from 'pdfjs-dist'
import { usePdfDocument } from 'src/composables/usePdfDocument'

const defaultPdfUrl = '/samples/demo.pdf'

const urlInput = ref(defaultPdfUrl)
const viewerSrc = ref<string | Blob | null>(defaultPdfUrl)
const {
  pdfDocument,
  loading: documentLoading,
  error: documentError,
} = usePdfDocument(viewerSrc, {
  disableAutoFetch: true,
  disableStream: true,
})
const loading = computed(() => documentLoading.value)
const error = ref('')
const statusMessage = ref('')
const pageIndex = ref(0)
const pageCount = ref(0)
const currentViewport = ref<PdfViewport | null>(null)
const textSelectMode = ref(true)
const fileInputRef = ref<HTMLInputElement | null>(null)
const manualScale = ref<number | null>(null)
const effectiveScale = ref(1)

const minScale = 0.5
const maxScale = 2
const zoomStep = 0.1

const emptyOverlayRects: Array<{ id: string; style: Record<string, string> }> = []

const totalPages = computed(() => (pageCount.value ? pageCount.value : 0))
const activePageDisplay = computed(() => (pageCount.value ? pageIndex.value + 1 : 0))
const canGoPrevious = computed(() => pageCount.value > 0 && pageIndex.value > 0)
const canGoNext = computed(() => pageCount.value > 0 && pageIndex.value < pageCount.value - 1)
const textSelectIcon = computed(() => (textSelectMode.value ? 'text_fields' : 'pan_tool'))
const currentViewportText = computed(() => {
  if (!currentViewport.value) return ''
  const { width, height, scale } = currentViewport.value
  const rounded = (value: number) => Math.round(value)
  return `${rounded(width)}×${rounded(height)} @ ${scale.toFixed(2)}×`
})
const isAutoScale = computed(() => manualScale.value === null)
const zoomBaseline = computed(() => manualScale.value ?? effectiveScale.value)
const canZoomIn = computed(() => zoomBaseline.value < maxScale - 0.001)
const canZoomOut = computed(() => zoomBaseline.value > minScale + 0.001)
const scaleDisplay = computed(() => `${Math.round(effectiveScale.value * 100)}%`)

const viewerDocument = computed(
  () => pdfDocument.value as PdfJsTypes.PDFDocumentProxy | null
)
const hasDocument = computed(() => pageCount.value > 0)
const viewerActive = computed(() => Boolean(viewerDocument.value))

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
  pageIndex.value = 0
  pageCount.value = 0
  currentViewport.value = null
  effectiveScale.value = 1
}

function triggerFileDialog() {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0] ?? null
  if (!file) {
    return
  }
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

function goFirst() {
  if (canGoPrevious.value) {
    pageIndex.value = 0
  }
}

function goLast() {
  if (canGoNext.value && pageCount.value) {
    pageIndex.value = pageCount.value - 1
  }
}

function toggleTextSelectMode() {
  textSelectMode.value = !textSelectMode.value
}

function zoomIn() {
  if (!canZoomIn.value) return
  const next = clamp(zoomBaseline.value + zoomStep, minScale, maxScale)
  manualScale.value = next
}

function zoomOut() {
  if (!canZoomOut.value) return
  const next = clamp(zoomBaseline.value - zoomStep, minScale, maxScale)
  manualScale.value = next
}

function resetZoom() {
  manualScale.value = null
}

function onScaleChange(payload: { scale: number; isAuto: boolean }) {
  effectiveScale.value = payload.scale
  if (payload.isAuto && manualScale.value !== null) {
    manualScale.value = null
  }
}

function onDocumentLoaded(payload: { pageCount: number }) {
  pageCount.value = payload.pageCount
  pageIndex.value = 0
  statusMessage.value = `Loaded document with ${payload.pageCount} page(s).`
}

function onDocumentUnloaded() {
  pageCount.value = 0
  pageIndex.value = 0
  currentViewport.value = null
  effectiveScale.value = 1
  if (!viewerActive.value) {
    statusMessage.value = ''
  }
}

function onRendered(payload: { viewport: PdfViewport }) {
  currentViewport.value = payload.viewport
}

function onLoadError(payload: { error: unknown }) {
  console.error(payload.error)
  error.value = 'Viewer failed to load the PDF.'
}

function onRenderError(payload: { error: unknown }) {
  console.error(payload.error)
  error.value = 'Unable to render the current page.'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

watch(documentError, (err) => {
  if (!err) return
  console.error(err)
  error.value = 'Viewer failed to load the PDF.'
  statusMessage.value = ''
})
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

.viewer-controls {
  flex-wrap: wrap;
}

.viewer-controls__divider {
  height: 24px;
}

.zoom-display {
  min-width: 56px;
  text-align: center;
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
