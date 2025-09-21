<template>
  <q-page class="q-pa-lg">
    <div class="row q-col-gutter-lg">
      <div class="col-12 col-md-4">
        <q-card bordered>
          <q-card-section>
            <div class="text-h6">Word → Markdown</div>
            <div class="text-caption text-grey-7">
              Convert .docx files to clean Markdown directly in your browser. Your files never leave
              your device.
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <q-file
              v-model="file"
              label="Select .docx file"
              accept=".docx"
              filled
              clearable
              @update:model-value="onFile"
            />
            <div class="q-mt-md">
              <q-btn
                :disable="!file || converting"
                color="primary"
                label="Convert"
                @click="convert"
              />
              <q-btn flat color="primary" class="q-ml-sm" label="Clear" @click="reset" />
            </div>
            <div v-if="error" class="text-negative q-mt-md">{{ error }}</div>
          </q-card-section>
        </q-card>

        <q-card bordered class="q-mt-lg">
          <q-card-section>
            <div class="text-subtitle1">Tips</div>
            <ul class="q-pl-md q-mt-sm">
              <li>Headings and lists in your document will map to Markdown automatically.</li>
              <li>Inline images are embedded as Data URLs in Markdown by default.</li>
              <li>You can copy the Markdown or download it as a .md file.</li>
            </ul>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-8">
        <q-card bordered>
          <q-card-section class="row items-center justify-between">
            <div class="text-subtitle1">Preview</div>
            <div>
              <q-btn
                size="sm"
                flat
                icon="content_copy"
                label="Copy"
                :disable="!markdown"
                @click="copyMarkdown"
              />
              <q-btn
                size="sm"
                flat
                icon="download"
                color="primary"
                label="Download .md"
                :disable="!markdown"
                @click="downloadMarkdown"
              />
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <q-skeleton v-if="converting" type="text" :repeat="8" />
            <div v-else-if="markdown" class="markdown-output">
              <pre style="white-space: pre-wrap">{{ markdown }}</pre>
            </div>
            <div v-else class="text-grey-6">Converted Markdown will appear here.</div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { convertDocxFileToMarkdown } from '../services/docxToMarkdown'

const file = ref<File | null>(null)
const markdown = ref<string>('')
const error = ref<string>('')
const converting = ref<boolean>(false)

function onFile() {
  error.value = ''
  markdown.value = ''
}

function reset() {
  file.value = null
  error.value = ''
  markdown.value = ''
}

async function convert() {
  error.value = ''
  markdown.value = ''
  if (!file.value) return
  converting.value = true
  try {
    markdown.value = await convertDocxFileToMarkdown(file.value, {
      inlineImages: true,
    })
  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : String(e)
    error.value = msg || 'Failed to convert document.'
  } finally {
    converting.value = false
  }
}

async function copyMarkdown() {
  if (!markdown.value) return
  await navigator.clipboard.writeText(markdown.value)
}

function downloadMarkdown() {
  if (!markdown.value) return
  const blob = new Blob([markdown.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const baseName = (file.value?.name || 'document').replace(/\.[^.]+$/, '')
  a.href = url
  a.download = `${baseName}.md`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.markdown-output {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 0.9rem;
}
</style>
