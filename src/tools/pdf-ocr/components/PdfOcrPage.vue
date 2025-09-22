<template>
  <q-page class="q-pa-lg">
    <div class="row q-col-gutter-lg">
      <div class="col-12 col-md-4">
        <q-card bordered>
          <q-card-section>
            <div class="text-h6">PDF OCR</div>
            <div class="text-caption text-grey-7">
              Convert a scanned or image-based PDF into a text-searchable document. All processing
              happens locally in your browser using Tesseract.js.
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

            <q-select v-model="dpi" :options="dpiOptions" filled label="Rendering DPI" />

            <q-select
              v-model="language"
              :options="languageOptions"
              filled
              use-input
              hide-dropdown-icon
              input-debounce="0"
              label="OCR Language"
              @new-value="onLanguageNewValue"
            />

            <q-btn
              color="primary"
              :disable="!canProcess"
              :loading="processing"
              label="Run OCR"
              @click="runOcr"
            />
            <q-btn flat color="primary" label="Clear" @click="reset" />
          </q-card-section>
        </q-card>

        <q-card bordered class="q-mt-lg">
          <q-card-section>
            <div class="text-subtitle1">Status</div>
            <div v-if="statusMessage" :class="statusClass">{{ statusMessage }}</div>
            <div v-else class="text-grey-6">Select a PDF and run OCR to see progress updates.</div>
            <q-linear-progress
              v-if="processing"
              :value="progressValue"
              color="primary"
              size="sm"
              class="q-mt-sm"
            />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-8">
        <q-card bordered>
          <q-card-section>
            <div class="row items-center justify-between">
              <div class="text-subtitle1">Preview</div>
              <q-btn
                flat
                dense
                icon="download"
                :disable="!downloadUrl"
                label="Download"
                @click="downloadResult"
              />
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div v-if="previewUrl" class="preview-frame">
              <object :data="previewUrl" type="application/pdf" title="PDF preview">
                <p class="text-grey-6 q-pa-md">This browser cannot display PDFs inline.</p>
              </object>
            </div>
            <div v-else class="text-grey-6">
              Upload a PDF to see a quick inline preview of the original document.
            </div>
          </q-card-section>
        </q-card>

        <q-card bordered class="q-mt-lg">
          <q-card-section>
            <div class="text-subtitle1">Recognized Text Preview</div>
            <div class="text-caption text-grey-6 q-mb-sm">
              The first few hundred characters detected by Tesseract. Use this to verify that OCR is
              working as expected.
            </div>
            <div v-if="ocrWarnings.length" class="ocr-warnings q-mb-sm">
              <div v-for="warning in ocrWarnings" :key="warning" class="text-negative">
                {{ warning }}
              </div>
            </div>
            <pre v-if="ocrPreview" class="ocr-preview">{{ ocrPreview }}</pre>
            <div v-else class="text-grey-6">Run OCR to see the extracted text.</div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import { createSearchablePdf } from '../services/pdfOcrPipeline'
import type { PdfOcrProgress } from '../types/ocr'

const file = ref<File | null>(null)
const dpi = ref(300)
const dpiOptions = [240, 300, 360, 400]
const language = ref('eng')
const languageOptions = ref([
  { label: 'English (eng)', value: 'eng' },
  { label: 'French (fra)', value: 'fra' },
  { label: 'German (deu)', value: 'deu' },
])
const processing = ref(false)
const statusMessage = ref('')
const statusVariant = ref<'neutral' | 'error' | 'success'>('neutral')
const progressValue = ref(0)
const previewUrl = ref('')
const downloadUrl = ref('')
const ocrPreview = ref('')
const ocrWarnings = ref<string[]>([])

const canProcess = computed(() => Boolean(file.value) && !processing.value)
const statusClass = computed(() => {
  if (statusVariant.value === 'error') return 'text-negative'
  if (statusVariant.value === 'success') return 'text-positive'
  return 'text-grey-7'
})

function reset() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
  file.value = null
  processing.value = false
  statusMessage.value = ''
  statusVariant.value = 'neutral'
  progressValue.value = 0
  previewUrl.value = ''
  downloadUrl.value = ''
  ocrPreview.value = ''
  ocrWarnings.value = []
}

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
})

function onLanguageNewValue(val: string, done: (value: string) => void) {
  const code = val.trim()
  if (!code) {
    done('')
    return
  }
  if (!languageOptions.value.some((option) => option.value === code)) {
    languageOptions.value.push({ label: `${code}`, value: code })
  }
  language.value = code
  done(code)
}

function onFileChange(selected: File | null) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
  downloadUrl.value = ''
  ocrPreview.value = ''
  ocrWarnings.value = []
  statusMessage.value = ''
  statusVariant.value = 'neutral'
  progressValue.value = 0
  file.value = selected
  if (selected) {
    previewUrl.value = URL.createObjectURL(selected)
  } else {
    previewUrl.value = ''
  }
}

async function runOcr() {
  if (!file.value) return
  processing.value = true
  statusMessage.value = 'Starting OCR pipeline...'
  statusVariant.value = 'neutral'
  progressValue.value = 0
  try {
    const { bytes, textPreview, warnings } = await createSearchablePdf(
      {
        file: file.value,
        dpi: dpi.value,
        language: language.value,
      },
      {
        onProgress: handleProgress,
      }
    )
    ocrPreview.value = textPreview
    ocrWarnings.value = warnings
    if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
    const buffer =
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? (bytes.buffer as ArrayBuffer)
        : bytes.slice().buffer
    const blob = new Blob([buffer], { type: 'application/pdf' })
    downloadUrl.value = URL.createObjectURL(blob)
    if (warnings.length) {
      statusMessage.value =
        'OCR completed with warnings. Review the notes below before downloading.'
      statusVariant.value = 'neutral'
    } else {
      statusMessage.value = 'OCR complete. Review and download the searchable PDF.'
      statusVariant.value = 'success'
    }
  } catch (error) {
    console.error(error)
    statusMessage.value =
      error instanceof Error ? error.message : 'Failed to perform OCR on the selected PDF.'
    statusVariant.value = 'error'
  } finally {
    progressValue.value = 0
    processing.value = false
  }
}

function handleProgress(progress: PdfOcrProgress) {
  const stageOffsets: Record<PdfOcrProgress['stage'], number> = {
    render: 0,
    ocr: 0.35,
    compose: 0.85,
  }
  const stageLengths: Record<PdfOcrProgress['stage'], number> = {
    render: 0.35,
    ocr: 0.5,
    compose: 0.15,
  }
  const offset = stageOffsets[progress.stage] ?? 0
  const length = stageLengths[progress.stage] ?? 0.1
  progressValue.value = Math.min(1, Math.max(0, offset + length * progress.progress))
  statusMessage.value = `Page ${progress.pageIndex + 1}: ${progress.stage.toUpperCase()} ${(progress.progress * 100).toFixed(0)}%`
}

function downloadResult() {
  if (!downloadUrl.value) return
  const anchor = document.createElement('a')
  anchor.href = downloadUrl.value
  anchor.download = 'searchable.pdf'
  anchor.click()
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
  max-height: 720px;
}

.preview-frame object {
  width: 100%;
  height: 640px;
  border: none;
}

.ocr-preview {
  background: #111;
  color: #cce0ff;
  padding: 12px;
  border-radius: 4px;
  max-height: 320px;
  overflow: auto;
  font-size: 0.85rem;
  white-space: pre-wrap;
}

.ocr-warnings {
  font-size: 0.8rem;
  line-height: 1.4;
}
</style>
