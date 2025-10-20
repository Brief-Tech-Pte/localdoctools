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
                <q-btn
                  outline
                  icon="upload_file"
                  label="Load Local PDF"
                  @click="triggerFileDialog"
                />
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
        <PdfViewerShell
          v-model:text-select-mode="textSelectMode"
          :document="viewerDocument"
          :overlay-rects="emptyOverlayRects"
          @document-loaded="onDocumentLoaded"
          @document-unloaded="onDocumentUnloaded"
          @load-error="onLoadError"
          @render-error="onRenderError"
        >
          <template #toolbar-end>
            <q-btn
              dense
              flat
              round
              :icon="textSelectMode ? 'text_fields' : 'pan_tool'"
              :color="textSelectMode ? 'primary' : 'grey-6'"
              :unelevated="textSelectMode"
              aria-label="Toggle text selection"
              @click="textSelectMode = !textSelectMode"
            >
              <q-tooltip>{{ textSelectMode ? 'Text selection' : 'Pan mode' }}</q-tooltip>
            </q-btn>
            <q-separator vertical inset spaced />
          </template>
          <template #empty>
            Enter a URL and click “Load PDF” to render it here. The default demo document is
            <code>/samples/demo.pdf</code>.
          </template>
        </PdfViewerShell>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type * as PdfJsTypes from 'pdfjs-dist'
import PdfViewerShell from 'src/components/pdf-viewer/PdfViewerShell.vue'
import { usePdfDocument } from 'src/components/pdf-viewer/composables/usePdfDocument'

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
const pageCount = ref(0)
const fileInputRef = ref<HTMLInputElement | null>(null)

const emptyOverlayRects: Array<{ id: string; style: Record<string, string> }> = []

const viewerDocument = computed(() => pdfDocument.value as PdfJsTypes.PDFDocumentProxy | null)
const viewerActive = computed(() => Boolean(viewerDocument.value))
const textSelectMode = ref(true)

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
  pageCount.value = 0
  statusMessage.value = ''
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

function onDocumentLoaded(payload: { pageCount: number }) {
  pageCount.value = payload.pageCount
  statusMessage.value = `Loaded document with ${payload.pageCount} page(s).`
}

function onDocumentUnloaded() {
  pageCount.value = 0
  if (!viewerActive.value) {
    statusMessage.value = ''
  }
}

function onLoadError(payload: { error: unknown }) {
  console.error(payload.error)
  error.value = 'Viewer failed to load the PDF.'
}

function onRenderError(payload: { error: unknown }) {
  console.error(payload.error)
  error.value = 'Unable to render the current page.'
}

watch(documentError, (err) => {
  if (!err) return
  console.error(err)
  error.value = 'Viewer failed to load the PDF.'
  statusMessage.value = ''
})
</script>

<style scoped>
.viewer-toolbar {
  padding: 0 16px;
  background: white;
  min-height: 52px;
  gap: 12px;
}

.viewer-toolbar :deep(.q-separator--vertical) {
  height: 28px;
  opacity: 0.35;
  margin: 0 8px;
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
