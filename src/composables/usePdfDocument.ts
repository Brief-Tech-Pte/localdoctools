import { markRaw, onBeforeUnmount, ref, watch } from 'vue'
import type * as PdfJsTypes from 'pdfjs-dist'
import * as pdfjsLib from 'pdfjs-dist'

export type PdfDocumentSource =
  | string
  | URL
  | Blob
  | ArrayBuffer
  | Uint8Array
  | null
  | undefined

export interface UsePdfDocumentOptions {
  disableAutoFetch?: boolean
  disableStream?: boolean
  rangeChunkSize?: number
}

type PdfJsModule = typeof PdfJsTypes

interface NormalizedSource {
  url?: string
  data?: ArrayBuffer | Uint8Array | Blob
}

export function usePdfDocument(
  sourceRef: { value: PdfDocumentSource },
  options: UsePdfDocumentOptions = {}
) {
  const pdfDocument = ref<PdfJsTypes.PDFDocumentProxy | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)

  const loadRequestId = ref(0)
  let loadingTask: PdfJsTypes.PDFDocumentLoadingTask | null = null
  let pdfjsModule: PdfJsModule | null = null
  let pdfWorkerInstance: Worker | null = null

  async function ensurePdfJs(): Promise<PdfJsModule> {
    if (pdfjsModule && pdfWorkerInstance) {
      return pdfjsModule
    }
    const workerModule = await import('pdfjs-dist/build/pdf.worker.mjs?worker')
    if (!pdfWorkerInstance) {
      pdfWorkerInstance = new workerModule.default()
    }
    pdfjsLib.GlobalWorkerOptions.workerPort = pdfWorkerInstance
    pdfjsModule = pdfjsLib
    return pdfjsModule
  }

  function normalizeSource(source: PdfDocumentSource): NormalizedSource | null {
    if (source == null) {
      return null
    }
    if (typeof source === 'string' || source instanceof URL) {
      return { url: source.toString() }
    }
    if (source instanceof Blob) {
      return { data: source }
    }
    if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
      return { data: source }
    }
    return null
  }

  async function toDataBuffer(
    data: NormalizedSource['data']
  ): Promise<ArrayBuffer | Uint8Array> {
    if (!data) return new ArrayBuffer(0)
    if (data instanceof Blob) {
      return data.arrayBuffer()
    }
    return data
  }

  async function load(source: PdfDocumentSource) {
    const normalized = normalizeSource(source)
    const token = ++loadRequestId.value

    if (loadingTask) {
      try {
        await loadingTask.destroy()
      } catch {
        // ignore
      } finally {
        loadingTask = null
      }
    }

    if (!normalized) {
      pdfDocument.value = null
      error.value = null
      loading.value = false
      return
    }

    loading.value = true
    error.value = null

    try {
      const pdfjs = await ensurePdfJs()
      if (token !== loadRequestId.value) return

      const params: Parameters<typeof pdfjs.getDocument>[0] = {}
      if (normalized.url) {
        params.url = normalized.url
      } else if (normalized.data) {
        const buffer = await toDataBuffer(normalized.data)
        if (token !== loadRequestId.value) return
        params.data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
      }

      params.disableAutoFetch = options.disableAutoFetch ?? false
      params.disableStream = options.disableStream ?? false
      params.rangeChunkSize = options.rangeChunkSize ?? 65536

      const nextTask = pdfjs.getDocument(params)
      loadingTask = nextTask
      const doc = await nextTask.promise
      if (loadingTask === nextTask) {
        loadingTask = null
      }

      if (token !== loadRequestId.value) {
        await destroyLoadingTask(nextTask)
        return
      }

      pdfDocument.value = markRaw(doc)
      error.value = null
    } catch (err) {
      error.value = err
      pdfDocument.value = null
    } finally {
      if (token === loadRequestId.value) {
        loading.value = false
      }
    }
  }

  async function destroyLoadingTask(task: PdfJsTypes.PDFDocumentLoadingTask | null) {
    if (!task) return
    try {
      await task.destroy()
    } catch {
      // ignore destruction failures
    }
  }

  watch(
    () => sourceRef.value,
    (newSource) => {
      void load(newSource)
    },
    { immediate: true }
  )

  onBeforeUnmount(async () => {
    const token = ++loadRequestId.value
    void token
    if (loadingTask) {
      await destroyLoadingTask(loadingTask)
      loadingTask = null
    }
    if (pdfDocument.value) {
      try {
        await pdfDocument.value.destroy()
      } catch {
        // ignore
      }
    }
    if (pdfWorkerInstance) {
      pdfWorkerInstance.terminate()
      pdfWorkerInstance = null
    }
    pdfDocument.value = null
  })

  return {
    pdfDocument,
    loading,
    error,
    reload: () => load(sourceRef.value),
  }
}
