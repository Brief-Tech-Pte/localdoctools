<template>
  <q-page class="q-pa-lg">
    <div class="row q-col-gutter-lg">
      <div class="col-12 col-md-4">
        <q-card bordered>
          <q-card-section>
            <div class="text-h6">PDF Redaction</div>
            <div class="text-caption text-grey-7">
              Burn redactions into each page using an image+OCR pipeline that keeps everything in
              the browser.
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section class="column q-gutter-sm">
            <q-file
              v-model="file"
              accept="application/pdf"
              filled
              clearable
              label="Select PDF"
              @update:model-value="onFileChange"
            />
            <q-select v-model="dpi" :options="dpiOptions" label="Processing DPI" filled />
            <div class="row items-center no-wrap q-gutter-sm">
              <q-btn
                icon="chevron_left"
                flat
                round
                dense
                :disable="!canGoPrevious"
                @click="goToPreviousPage"
              />
              <q-input
                v-model.number="pageInput"
                type="number"
                min="1"
                :max="maxPageIndex + 1"
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
                @click="goToNextPage"
              />
            </div>
            <div class="text-caption text-grey-6">
              Click and drag on the preview to draw redaction rectangles. Existing marks render as
              semi-opaque overlays.
            </div>
            <q-btn
              color="primary"
              :disable="!canProcess"
              :loading="processing"
              label="Apply redactions"
              @click="applyRedactions"
            />
            <q-btn flat color="primary" label="Clear" @click="clearAll" />
            <q-btn
              flat
              dense
              icon="download"
              :disable="!downloadUrl"
              label="Download result"
              @click="downloadResult"
            />
          </q-card-section>
        </q-card>

        <q-card bordered class="q-mt-lg">
          <q-card-section class="column q-gutter-sm">
            <div class="text-subtitle1">Redaction Marks</div>
            <div v-if="!redactionMarks.length" class="text-grey-6">
              No redactions yet. Add one to preview the spec structure.
            </div>
            <q-list v-else bordered separator class="rounded-borders">
              <q-item v-for="mark in redactionMarks" :key="mark.id">
                <q-item-section>
                  <q-item-label class="text-body2">Page {{ mark.pageIndex + 1 }}</q-item-label>
                  <q-item-label caption>
                    {{ mark.rects.length }} rectangle(s)
                    <span v-if="mark.reason">· {{ mark.reason }}</span>
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn flat dense round icon="delete" @click="removeMark(mark.id)" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>

        <q-card bordered class="q-mt-lg">
          <q-card-section>
            <div class="text-subtitle1">Pipeline status</div>
            <div v-if="statusMessage" :class="statusClass">{{ statusMessage }}</div>
            <div v-else class="text-grey-6">Status updates will appear here while processing.</div>
            <q-linear-progress v-if="processing" indeterminate color="primary" class="q-mt-sm" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-8">
        <PdfViewerShell
          v-model:page-index="activePageIndex"
          v-model:text-select-mode="textSelectMode"
          :document="viewerDocument"
          :overlay-rects="overlayRects"
          :drawing-rect-style="drawingRectStyle"
          :show-drawing-rect="showDrawingRect"
          :enable-pan="false"
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
        >
          <template #toolbar-end>
            <q-btn
              dense
              flat
              round
              :icon="textSelectMode ? 'text_fields' : 'crop_square'"
              :color="textSelectMode ? 'primary' : 'red-5'"
              :unelevated="!textSelectMode"
              aria-label="Toggle drawing mode"
              @click="textSelectMode = !textSelectMode"
            >
              <q-tooltip>
                {{ textSelectMode ? 'Text selection' : 'Draw redactions' }}
              </q-tooltip>
            </q-btn>

            <q-separator vertical inset spaced />
          </template>
          <template #empty>
            Select a PDF to render the current page and start drawing redactions.
          </template>
        </PdfViewerShell>

        <q-card bordered class="q-mt-lg">
          <q-card-section>
            <div class="text-subtitle1">Redaction Spec JSON</div>
            <div class="text-caption text-grey-6 q-mb-sm">
              This JSON payload is what the worker-based pipeline consumes.
            </div>
            <pre class="spec-json">{{ formattedSpec }}</pre>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { exportFile } from 'quasar'

import PdfViewerShell from 'src/components/pdf-viewer/PdfViewerShell.vue'
import type {
  OverlayPointerPayload,
  PdfViewport as ViewerViewport,
  TextSelectionPayload,
} from 'src/components/pdf-viewer/pdfViewerTypes'
import type * as PdfJsTypes from 'pdfjs-dist'
import { usePdfDocument } from 'src/components/pdf-viewer/composables/usePdfDocument'
import type { PdfRedactionProgress, RedactionMark, RedactionRect } from '../types/redaction'
import {
  buildRedactionSpec,
  computeFileHash,
  createRedactedPdf,
} from '../services/pdfRedactionPipeline'

const file = ref<File | null>(null)
const dpi = ref(300)
const dpiOptions = [150, 200, 240, 300, 360, 400]
const redactionMarks = ref<Array<RedactionMark & { id: string }>>([])
const processing = ref(false)
const statusMessage = ref('')
const statusVariant = ref<'neutral' | 'error' | 'success'>('neutral')
const downloadUrl = ref('')
const pdfHash = ref('')
const lastResultBytes = ref<ArrayBuffer | null>(null)

const pageCount = ref(0)
const activePageIndex = ref(0)
const viewerSrc = ref<Blob | null>(null)
const { pdfDocument, error: documentError } = usePdfDocument(viewerSrc, {
  disableAutoFetch: true,
  disableStream: true,
})
const viewerDocument = computed(() => pdfDocument.value as PdfJsTypes.PDFDocumentProxy | null)
const currentViewport = ref<ViewerViewport | null>(null)

const drawingState = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const drawingPointerId = ref<number | null>(null)
const pointerOrigin = ref<{ x: number; y: number } | null>(null)

const textSelectMode = ref(false)
const loadRequestId = ref(0)

const showDrawingRect = computed(() => Boolean(drawingState.value))

const hasDocument = computed(() => pageCount.value > 0)
const marksForActivePage = computed(() =>
  redactionMarks.value.filter((mark) => mark.pageIndex === activePageIndex.value)
)
const maxPageIndex = computed(() => (pageCount.value > 0 ? pageCount.value - 1 : 0))

const overlayRects = computed(() => {
  if (!currentViewport.value) {
    return [] as Array<{ id: string; style: Record<string, string> }>
  }
  return marksForActivePage.value.flatMap((mark) =>
    mark.rects.map((rect, index) => ({
      id: `${mark.id}-${index}`,
      style: mapPdfRectToOverlay(rect),
    }))
  )
})

const drawingRectStyle = computed(() => {
  const rect = drawingState.value
  if (!rect) return {}
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
})

const canProcess = computed(() => Boolean(file.value && redactionMarks.value.length))
const statusClass = computed(() => {
  if (statusVariant.value === 'error') return 'text-negative'
  if (statusVariant.value === 'success') return 'text-positive'
  return 'text-grey-7'
})

const canGoPrevious = computed(() => hasDocument.value && activePageIndex.value > 0)
const canGoNext = computed(() => hasDocument.value && activePageIndex.value < maxPageIndex.value)

const pageInput = computed({
  get: () => (hasDocument.value ? activePageIndex.value + 1 : 1),
  set: (value: number | string) => {
    if (!hasDocument.value) return
    const numeric = Number(value)
    const clamped = clampPageNumber(Number.isFinite(numeric) ? numeric : 1)
    activePageIndex.value = clamped - 1
  },
})

const formattedSpec = computed(() => {
  if (!file.value) {
    return JSON.stringify({ marks: [] }, null, 2)
  }
  const spec = buildRedactionSpec(serializeMarks(redactionMarks.value), pdfHash.value)
  return JSON.stringify(spec, null, 2)
})

onBeforeUnmount(() => {
  clearDownloadUrl()
})

function clearDownloadUrl() {
  if (downloadUrl.value) {
    URL.revokeObjectURL(downloadUrl.value)
    downloadUrl.value = ''
  }
}

interface ResetViewerOptions {
  keepSrc?: boolean
}

function resetViewerState(options: ResetViewerOptions = {}) {
  const { keepSrc = false } = options
  if (!keepSrc) {
    viewerSrc.value = null
  }
  pageCount.value = 0
  activePageIndex.value = 0
  currentViewport.value = null
  drawingPointerId.value = null
  pointerOrigin.value = null
  drawingState.value = null
}

function reset() {
  clearDownloadUrl()
  resetViewerState()
  file.value = null
  pdfHash.value = ''
  redactionMarks.value = []
  processing.value = false
  statusMessage.value = ''
  statusVariant.value = 'neutral'
  lastResultBytes.value = null
  textSelectMode.value = false
}

function clearAll() {
  loadRequestId.value += 1
  reset()
}

async function onFileChange(newFile: File | null) {
  const token = ++loadRequestId.value
  reset()
  if (!newFile) return
  file.value = newFile
  statusMessage.value = 'Loading PDF…'
  statusVariant.value = 'neutral'

  try {
    const hash = await computeFileHash(newFile)
    if (token !== loadRequestId.value || file.value !== newFile) return
    pdfHash.value = hash
    viewerSrc.value = newFile
  } catch (error) {
    console.error(error)
    if (token === loadRequestId.value) {
      statusMessage.value = 'Failed to load PDF. Please try again.'
      statusVariant.value = 'error'
    }
  }
}

function goToPreviousPage() {
  if (activePageIndex.value > 0) {
    activePageIndex.value -= 1
  }
}

function goToNextPage() {
  if (pageCount.value && activePageIndex.value < pageCount.value - 1) {
    activePageIndex.value += 1
  }
}

function handleDocumentLoaded(payload: { pageCount: number }) {
  pageCount.value = payload.pageCount
  activePageIndex.value = 0
  statusMessage.value = 'PDF loaded. Draw rectangles on the preview to mark redactions.'
  statusVariant.value = 'neutral'
}

function handleDocumentUnloaded() {
  resetViewerState({ keepSrc: true })
}

function handleRendered(payload: { viewport: ViewerViewport }) {
  currentViewport.value = payload.viewport
}

function handleLoadError({ error }: { error: unknown }) {
  console.error(error)
  statusMessage.value = 'Failed to load PDF. Please try again.'
  statusVariant.value = 'error'
  resetViewerState()
}

function handleRenderError({ error }: { error: unknown }) {
  console.error(error)
  statusMessage.value = 'Unable to render the current page.'
  statusVariant.value = 'error'
}

function handleOverlayPointerDown(payload: OverlayPointerPayload) {
  if (!currentViewport.value || textSelectMode.value) return
  if (drawingPointerId.value !== null) return
  drawingPointerId.value = payload.pointerId
  pointerOrigin.value = { ...payload.point }
  drawingState.value = {
    x: payload.point.x,
    y: payload.point.y,
    width: 0,
    height: 0,
  }
  payload.originalEvent?.preventDefault()
}

function handleOverlayPointerMove(payload: OverlayPointerPayload) {
  if (drawingPointerId.value !== payload.pointerId || !pointerOrigin.value) return
  const origin = pointerOrigin.value
  const point = payload.point
  drawingState.value = {
    x: Math.min(origin.x, point.x),
    y: Math.min(origin.y, point.y),
    width: Math.abs(point.x - origin.x),
    height: Math.abs(point.y - origin.y),
  }
  payload.originalEvent?.preventDefault()
}

function handleOverlayPointerUp(payload: OverlayPointerPayload) {
  if (drawingPointerId.value !== payload.pointerId) return
  finalizeDrawing(true)
  payload.originalEvent?.preventDefault()
}

function handleOverlayPointerCancel(payload: { pointerId: number }) {
  if (drawingPointerId.value !== payload.pointerId) return
  finalizeDrawing(false)
}

function finalizeDrawing(shouldPersist: boolean) {
  const rect = drawingState.value
  drawingPointerId.value = null
  pointerOrigin.value = null
  drawingState.value = null

  if (!shouldPersist || !rect || rect.width < 4 || rect.height < 4) {
    return
  }

  const pdfRect = convertOverlayRectToPdf(rect)
  if (!pdfRect) return

  redactionMarks.value.push({
    id: crypto.randomUUID(),
    pageIndex: activePageIndex.value,
    rects: [pdfRect],
  })
  statusMessage.value = 'Added redaction rectangle.'
  statusVariant.value = 'success'
}

function handleTextSelection(payload: TextSelectionPayload) {
  if (!textSelectMode.value || !payload.pdfRects.length) return
  const rects: RedactionRect[] = payload.pdfRects.map(({ x, y, width, height }) => ({
    x,
    y,
    width,
    height,
  }))
  redactionMarks.value.push({
    id: crypto.randomUUID(),
    pageIndex: activePageIndex.value,
    rects,
  })
  statusMessage.value = 'Added redaction from selected text.'
  statusVariant.value = 'success'
  window.getSelection()?.removeAllRanges()
}

function clampPageNumber(value: number) {
  if (!pageCount.value) return 1
  if (!Number.isFinite(value)) return 1
  return Math.min(Math.max(Math.round(value), 1), pageCount.value)
}

function mapPdfRectToOverlay(rect: RedactionRect): Record<string, string> {
  if (!currentViewport.value) return {}
  const { scale, height } = currentViewport.value
  const left = rect.x * scale
  const width = rect.width * scale
  const overlayHeight = rect.height * scale
  const top = height - (rect.y + rect.height) * scale
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${overlayHeight}px`,
  }
}

function convertOverlayRectToPdf(rect: {
  x: number
  y: number
  width: number
  height: number
}): RedactionRect | null {
  if (!currentViewport.value) return null
  const { scale, height } = currentViewport.value
  const width = rect.width / scale
  const heightPoints = rect.height / scale
  const x = rect.x / scale
  const y = (height - (rect.y + rect.height)) / scale
  return { x, y, width, height: heightPoints }
}

function removeMark(id: string) {
  redactionMarks.value = redactionMarks.value.filter((mark) => mark.id !== id)
}

async function applyRedactions() {
  if (!file.value || !redactionMarks.value.length) return
  processing.value = true
  statusMessage.value = 'Starting PDF redaction pipeline (alpha).'
  statusVariant.value = 'neutral'
  try {
    const spec = buildRedactionSpec(serializeMarks(redactionMarks.value), pdfHash.value)
    const bytes = await createRedactedPdf(
      {
        file: file.value,
        spec,
        dpi: dpi.value,
      },
      {
        onProgress: handleProgress,
      }
    )
    clearDownloadUrl()
    const arrayBuffer: ArrayBuffer =
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? (bytes.buffer as ArrayBuffer)
        : bytes.slice().buffer
    downloadUrl.value = URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/pdf' }))
    lastResultBytes.value = arrayBuffer
    statusMessage.value = 'Redaction pipeline completed. Review and download the output PDF.'
    statusVariant.value = 'success'

    const redactedBlob = new Blob([arrayBuffer], { type: 'application/pdf' })
    const redactedFile = new File([redactedBlob], 'redacted.pdf', { type: 'application/pdf' })
    const token = ++loadRequestId.value
    redactionMarks.value = []
    file.value = redactedFile
    resetViewerState()
    const newHash = await computeFileHash(redactedFile)
    if (token !== loadRequestId.value || file.value !== redactedFile) return
    pdfHash.value = newHash
    viewerSrc.value = redactedFile
  } catch (error) {
    console.error(error)
    statusMessage.value =
      error instanceof Error ? error.message : 'Failed to apply redactions in the browser.'
    statusVariant.value = 'error'
  } finally {
    processing.value = false
  }
}

function handleProgress(progress: PdfRedactionProgress) {
  statusMessage.value = `Page ${progress.pageIndex + 1}: ${progress.stage}…`
}

watch(documentError, (err) => {
  if (!err) return
  console.error(err)
  statusMessage.value = 'Failed to load PDF. Please try again.'
  statusVariant.value = 'error'
})

function downloadResult() {
  if (!lastResultBytes.value) return
  exportFile('redacted.pdf', lastResultBytes.value, {
    mimeType: 'application/pdf',
  })
}

function serializeMarks(marks: Array<RedactionMark & { id: string }>): RedactionMark[] {
  return marks.map(({ pageIndex, rects, reason }) => ({
    pageIndex,
    rects,
    ...(reason ? { reason } : {}),
  }))
}
</script>

<style scoped>
.preview-frame {
  border: 1px solid var(--q-primary);
  border-radius: 4px;
  background: #fafafa;
  padding: 16px;
  display: flex;
  justify-content: center;
  overflow: hidden;
}

.page-input {
  min-width: 96px;
}

.spec-json {
  background: #111;
  color: #cce0ff;
  padding: 12px;
  border-radius: 4px;
  max-height: 320px;
  overflow: auto;
  font-size: 0.75rem;
}
</style>
