import type * as PdfJsTypes from 'pdfjs-dist'
import type * as PdfLibTypes from 'pdf-lib'
import type {
  PdfRedactionProgress,
  PdfRedactionRequest,
  RedactionMark,
  RedactionRect,
  RedactionSpec,
} from '../types/redaction'

export interface CreateRedactedPdfOptions {
  onProgress?: (status: PdfRedactionProgress) => void
}

type PdfJsModule = typeof PdfJsTypes
type PdfLibModule = typeof PdfLibTypes

const POINTS_PER_INCH = 72
const CANVAS_MIN_SIZE = 2

let pdfjsModule: PdfJsModule | null = null
let pdfWorker: Worker | null = null
let pdfLibModule: PdfLibModule | null = null

function ensureSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Web Crypto API is not available in this environment.')
  }
  return subtle
}

function bytesToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if ('arrayBuffer' in blob && typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer()
  }
  const response = new Response(blob)
  return response.arrayBuffer()
}

export async function computeFileHash(
  file: File | Blob,
  algorithm: string = 'SHA-256'
): Promise<string> {
  const subtle = ensureSubtleCrypto()
  const buffer = await blobToArrayBuffer(file)
  const digest = await subtle.digest(algorithm, buffer)
  return bytesToHex(digest)
}

export function buildRedactionSpec(marks: RedactionMark[], pdfHash: string): RedactionSpec {
  return {
    marks,
    pdfHash,
    createdAt: new Date().toISOString(),
  }
}

export async function createRedactedPdf(
  request: PdfRedactionRequest,
  options: CreateRedactedPdfOptions = {}
): Promise<Uint8Array> {
  const pdfjs = await ensurePdfJs()
  const pdfLib = await ensurePdfLib()

  const arrayBuffer = await request.file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
  const sourceDocument = await loadingTask.promise

  try {
    const outputPdf = await pdfLib.PDFDocument.create()
    const dpiScale = Math.max(request.dpi, POINTS_PER_INCH) / POINTS_PER_INCH

    const marksByPage = groupMarksByPage(request.spec.marks)
    const pageCount = sourceDocument.numPages

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      reportProgress(options.onProgress, pageIndex, 'render', 0)

      const page = await sourceDocument.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: dpiScale })
      const renderResult = await renderPageWithMasks(
        page,
        viewport,
        marksByPage.get(pageIndex) ?? []
      )

      reportProgress(options.onProgress, pageIndex, 'mask', 0.5)

      reportProgress(options.onProgress, pageIndex, 'ocr', 0.75)

      const pdfPage = outputPdf.addPage([renderResult.widthPt, renderResult.heightPt])
      const embeddedImage = await outputPdf.embedPng(renderResult.imageBytes)

      pdfPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: renderResult.widthPt,
        height: renderResult.heightPt,
      })

      reportProgress(options.onProgress, pageIndex, 'compose', 1)
    }

    return outputPdf.save({ useObjectStreams: false })
  } finally {
    // pdf.js performs its own cleanup when references go out of scope.
  }
}

function groupMarksByPage(marks: RedactionMark[]): Map<number, RedactionRect[]> {
  const grouped = new Map<number, RedactionRect[]>()
  marks.forEach((mark) => {
    const existing = grouped.get(mark.pageIndex)
    const rects = existing ?? []
    rects.push(...mark.rects)
    grouped.set(mark.pageIndex, rects)
  })
  return grouped
}

async function renderPageWithMasks(
  page: PdfJsTypes.PDFPageProxy,
  viewport: PdfJsTypes.PageViewport,
  rects: RedactionRect[]
): Promise<{ imageBytes: Uint8Array; widthPt: number; heightPt: number }> {
  const canvas = createCanvas(viewport.width, viewport.height)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to acquire 2D canvas context for PDF redaction.')
  }

  const renderTask = page.render({
    canvasContext: context,
    viewport,
    canvas,
  })
  await renderTask.promise

  if (rects.length) {
    context.save()
    context.fillStyle = '#000'
    for (const rect of rects) {
      drawMaskRect(context, rect, viewport)
    }
    context.restore()
  }

  const imageBytes = await canvasToPngBytes(canvas)
  const widthPt = viewport.width / viewport.scale
  const heightPt = viewport.height / viewport.scale

  destroyCanvas(canvas)
  return { imageBytes, widthPt, heightPt }
}

function drawMaskRect(
  context: CanvasRenderingContext2D,
  rect: RedactionRect,
  viewport: PdfJsTypes.PageViewport
) {
  const scale = viewport.scale
  const width = Math.max(rect.width * scale, CANVAS_MIN_SIZE)
  const height = Math.max(rect.height * scale, CANVAS_MIN_SIZE)
  const x = rect.x * scale
  const y = viewport.height - (rect.y + rect.height) * scale
  context.fillRect(x, y, width, height)
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Failed to encode canvas to PNG.'))
    }, 'image/png')
  })
  const buffer = await blob.arrayBuffer()
  return new Uint8Array(buffer)
}

function destroyCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

async function ensurePdfJs(): Promise<PdfJsModule> {
  if (pdfjsModule && pdfWorker) {
    return pdfjsModule
  }
  const [module, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker?worker'),
  ])
  if (!pdfWorker) {
    pdfWorker = new workerModule.default()
  }
  module.GlobalWorkerOptions.workerPort = pdfWorker
  pdfjsModule = module
  return module
}

async function ensurePdfLib(): Promise<PdfLibModule> {
  if (!pdfLibModule) {
    pdfLibModule = await import('pdf-lib')
  }
  return pdfLibModule
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    throw new Error('Canvas is not available in this environment.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(Math.floor(width), CANVAS_MIN_SIZE)
  canvas.height = Math.max(Math.floor(height), CANVAS_MIN_SIZE)
  return canvas
}

function reportProgress(
  callback: CreateRedactedPdfOptions['onProgress'] | undefined,
  pageIndex: number,
  stage: PdfRedactionProgress['stage'],
  progress: number
) {
  callback?.({ pageIndex, stage, progress })
}
