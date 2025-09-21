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
            <q-btn flat color="primary" label="Clear" @click="reset" />
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
        <q-card bordered>
          <q-card-section>
            <div class="row items-center justify-between">
              <div class="text-subtitle1">Preview</div>
              <div class="row items-center q-gutter-sm">
                <div class="text-caption text-grey-7">
                  Page {{ activePageDisplay }} / {{ totalPagesDisplay }}
                </div>
                <q-btn
                  flat
                  dense
                  icon="download"
                  :disable="!downloadUrl"
                  label="Download"
                  @click="downloadResult"
                />
              </div>
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div v-if="hasDocument" class="preview-frame">
              <div ref="viewerRef" class="page-viewer">
                <canvas ref="pageCanvas" class="page-canvas" />
                <div
                  v-if="currentViewport"
                  ref="overlayRef"
                  class="page-overlay"
                  @pointerdown="onOverlayPointerDown"
                  @pointermove="onOverlayPointerMove"
                  @pointerup="onOverlayPointerUp"
                  @pointercancel="onOverlayPointerCancel"
                >
                  <div
                    v-for="rect in overlayRects"
                    :key="rect.id"
                    class="overlay-rect"
                    :style="rect.style"
                  />
                  <div v-if="drawingState" class="overlay-rect drawing" :style="drawingRectStyle" />
                </div>
              </div>
            </div>
            <div v-else class="text-grey-6">
              Select a PDF to render the current page and start drawing redactions.
            </div>
          </q-card-section>
        </q-card>

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
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type * as PdfJsTypes from 'pdfjs-dist'
import type { PdfRedactionProgress, RedactionMark, RedactionRect } from '../types/redaction'
import {
  buildRedactionSpec,
  computeFileHash,
  createRedactedPdf,
} from '../services/pdfRedactionPipeline'

type PdfJsModule = typeof PdfJsTypes
type PDFDocumentProxy = PdfJsTypes.PDFDocumentProxy

const file = ref<File | null>(null)
const dpi = ref(300)
const dpiOptions = [150, 200, 240, 300, 360, 400]
const redactionMarks = ref<Array<RedactionMark & { id: string }>>([])
const processing = ref(false)
const statusMessage = ref('')
const statusVariant = ref<'neutral' | 'error' | 'success'>('neutral')
const downloadUrl = ref('')
const pdfHash = ref('')

const pdfDoc = ref<PDFDocumentProxy | null>(null)
const activePageIndex = ref(0)
const maxPageIndex = ref(0)

const pageCanvas = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLDivElement | null>(null)
const viewerRef = ref<HTMLDivElement | null>(null)
const currentViewport = ref<{ width: number; height: number; scale: number } | null>(null)

const drawingState = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const drawingPointerId = ref<number | null>(null)
const pointerOrigin = ref<{ x: number; y: number } | null>(null)

const resizeTimeout = ref<number | undefined>()

let pdfjsModule: PdfJsModule | null = null
let pdfWorkerInstance: Worker | null = null
let renderTask: ReturnType<PdfJsTypes.PDFPageProxy['render']> | null = null

const hasDocument = computed(() => pdfDoc.value !== null)
const marksForActivePage = computed(() =>
  redactionMarks.value.filter((mark) => mark.pageIndex === activePageIndex.value)
)

const overlayRects = computed(() => {
  if (!currentViewport.value) return [] as Array<{ id: string; style: Record<string, string> }>
  return marksForActivePage.value.flatMap((mark) =>
    mark.rects.map((rect, index) => {
      const style = mapPdfRectToOverlay(rect)
      return {
        id: `${mark.id}-${index}`,
        style,
      }
    })
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

const activePageDisplay = computed(() => (hasDocument.value ? activePageIndex.value + 1 : 0))
const totalPagesDisplay = computed(() => (hasDocument.value ? maxPageIndex.value + 1 : 0))

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

watch(activePageIndex, async () => {
  if (!pdfDoc.value) return
  await renderCurrentPage()
})

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  clearDownloadUrl()
  cancelRenderTask()
  window.removeEventListener('resize', handleResize)
  if (pdfWorkerInstance) {
    pdfWorkerInstance.terminate()
    pdfWorkerInstance = null
  }
})

function clearDownloadUrl() {
  if (downloadUrl.value) {
    URL.revokeObjectURL(downloadUrl.value)
    downloadUrl.value = ''
  }
}

function reset() {
  clearDownloadUrl()
  cancelRenderTask()
  file.value = null
  pdfHash.value = ''
  redactionMarks.value = []
  processing.value = false
  statusMessage.value = ''
  statusVariant.value = 'neutral'
  activePageIndex.value = 0
  maxPageIndex.value = 0
  currentViewport.value = null
  pointerOrigin.value = null
  drawingState.value = null
  pdfDoc.value = null
}

async function onFileChange(newFile: File | null) {
  try {
    reset()
    file.value = newFile
    if (!newFile) return
    pdfHash.value = await computeFileHash(newFile)
    await loadPdfDocument(newFile)
  } catch (e) {
    console.error(e)
    statusMessage.value = 'Failed to load PDF. Please try again.'
    statusVariant.value = 'error'
  }
}

async function loadPdfDocument(selectedFile: File) {
  cancelRenderTask()
  const pdfjs = await ensurePdfJs()
  const arrayBuffer = await selectedFile.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
  const doc = await loadingTask.promise
  pdfDoc.value = markRaw(doc)
  maxPageIndex.value = Math.max(0, doc.numPages - 1)
  activePageIndex.value = 0
  statusMessage.value = 'PDF loaded. Draw rectangles on the preview to mark redactions.'
  statusVariant.value = 'neutral'
  await nextTick()
  await renderCurrentPage()
}

async function renderCurrentPage() {
  if (!pdfDoc.value || !pageCanvas.value) return
  const pageNumber = Math.min(activePageIndex.value, pdfDoc.value.numPages - 1) + 1
  const page = await pdfDoc.value.getPage(pageNumber)
  const baseViewport = page.getViewport({ scale: 1 })

  await nextTick()

  const containerWidth = viewerRef.value?.clientWidth ?? baseViewport.width
  const rawScale = containerWidth ? containerWidth / baseViewport.width : 1
  const scale = Math.min(Math.max(rawScale, 0.5), 2)
  const viewport = page.getViewport({ scale })
  const canvas = pageCanvas.value
  const context = canvas.getContext('2d')
  if (!context) return

  cancelRenderTask()

  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`

  const task = page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  })
  renderTask = task

  try {
    await task.promise
  } catch (error) {
    if ((error as { name?: string }).name !== 'RenderingCancelledException') {
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

async function ensurePdfJs(): Promise<PdfJsModule> {
  if (pdfjsModule && pdfWorkerInstance) {
    return pdfjsModule
  }
  const [module, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker?worker'),
  ])
  if (!pdfWorkerInstance) {
    pdfWorkerInstance = new workerModule.default()
  }
  module.GlobalWorkerOptions.workerPort = pdfWorkerInstance
  pdfjsModule = module
  return module
}

function goToPreviousPage() {
  if (canGoPrevious.value) {
    activePageIndex.value -= 1
  }
}

function goToNextPage() {
  if (canGoNext.value) {
    activePageIndex.value += 1
  }
}

function clampPageNumber(value: number) {
  const pageCount = maxPageIndex.value + 1
  if (!Number.isFinite(value)) return 1
  return Math.min(Math.max(Math.round(value), 1), pageCount)
}

function handleResize() {
  if (!hasDocument.value) return
  if (resizeTimeout.value) window.clearTimeout(resizeTimeout.value)
  resizeTimeout.value = window.setTimeout(() => {
    void renderCurrentPage()
  }, 150)
}

function onOverlayPointerDown(event: PointerEvent) {
  if (!currentViewport.value || !overlayRef.value) return
  if (drawingPointerId.value !== null) return
  overlayRef.value.setPointerCapture(event.pointerId)
  drawingPointerId.value = event.pointerId
  const point = getRelativePoint(event)
  pointerOrigin.value = point
  drawingState.value = { x: point.x, y: point.y, width: 0, height: 0 }
  event.preventDefault()
}

function onOverlayPointerMove(event: PointerEvent) {
  if (drawingPointerId.value !== event.pointerId || !pointerOrigin.value) return
  const point = getRelativePoint(event)
  const origin = pointerOrigin.value
  drawingState.value = {
    x: Math.min(origin.x, point.x),
    y: Math.min(origin.y, point.y),
    width: Math.abs(point.x - origin.x),
    height: Math.abs(point.y - origin.y),
  }
  event.preventDefault()
}

function onOverlayPointerUp(event: PointerEvent) {
  if (drawingPointerId.value !== event.pointerId) return
  finalizeDrawing(true)
  event.preventDefault()
}

function onOverlayPointerCancel(event: PointerEvent) {
  if (drawingPointerId.value !== event.pointerId) return
  finalizeDrawing(false)
}

function finalizeDrawing(shouldPersist: boolean) {
  if (drawingPointerId.value !== null && overlayRef.value) {
    overlayRef.value.releasePointerCapture(drawingPointerId.value)
  }
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

function getRelativePoint(event: PointerEvent) {
  const overlay = overlayRef.value
  const viewport = currentViewport.value
  if (!overlay || !viewport) {
    return { x: 0, y: 0 }
  }
  const bounds = overlay.getBoundingClientRect()
  const x = clamp(event.clientX - bounds.left, 0, viewport.width)
  const y = clamp(event.clientY - bounds.top, 0, viewport.height)
  return { x, y }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
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
    statusMessage.value = 'Redaction pipeline completed. Review and download the output PDF.'
    statusVariant.value = 'success'
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

function downloadResult() {
  if (!downloadUrl.value) return
  const anchor = document.createElement('a')
  anchor.href = downloadUrl.value
  anchor.download = 'redacted.pdf'
  anchor.click()
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
  overflow: auto;
  max-height: 720px;
}

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
}

.page-overlay {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  touch-action: none;
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
