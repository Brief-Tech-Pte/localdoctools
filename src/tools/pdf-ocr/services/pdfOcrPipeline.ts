import type * as PdfJsTypes from 'pdfjs-dist'
import type * as PdfLibTypes from 'pdf-lib'
import type { Worker as TesseractWorker } from 'tesseract.js'

import type {
  PdfOcrOptions,
  PdfOcrProgress,
  PdfOcrRequest,
  PdfOcrResult,
  OcrWord,
} from '../types/ocr'

const MIN_CONFIDENCE = 40
const POINTS_PER_INCH = 72
const MIN_OCR_DIMENSION = 16
const TESSERACT_WORKER_PATH = '/tesseract/worker.min.js'
const TESSERACT_CORE_PATH = '/tesseract/core/'
const TESSERACT_LANG_PATH = '/tesseract/4.0.0/'
const BUNDLED_LANGUAGES = new Set(['eng', 'fra', 'deu', 'osd'])

type PdfJsModule = typeof PdfJsTypes
type PdfLibModule = typeof PdfLibTypes

let pdfjsModule: PdfJsModule | null = null
let pdfWorker: Worker | null = null
let pdfLibModule: PdfLibModule | null = null
let tesseractWorker: TesseractWorker | null = null
let workerLanguage: string | null = null

export async function createSearchablePdf(
  request: PdfOcrRequest,
  options: PdfOcrOptions = {}
): Promise<PdfOcrResult> {
  const pdfjs = await ensurePdfJs()
  const pdfLib = await ensurePdfLib()
  const worker = await ensureTesseractWorker(request.language)

  const arrayBuffer = await request.file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
  const sourceDocument = await loadingTask.promise

  const outputPdf = await pdfLib.PDFDocument.create()
  const helvetica = pdfLib.StandardFonts.Helvetica ?? 'Helvetica'
  const embeddedFont = await outputPdf.embedFont(helvetica)

  const dpiScale = Math.max(request.dpi, POINTS_PER_INCH) / POINTS_PER_INCH

  const textSnippets: string[] = []
  const warnings: string[] = []

  const pageCount = sourceDocument.numPages
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    reportProgress(options.onProgress, pageIndex, 'render', 0)

    const page = await sourceDocument.getPage(pageIndex + 1)
    const viewport = page.getViewport({ scale: dpiScale })
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to obtain 2D canvas context for OCR rendering.')
    }

    await page.render({
      canvasContext: context,
      viewport,
      canvas, // some pdf.js type definitions require the canvas element alongside the context
    }).promise

    reportProgress(options.onProgress, pageIndex, 'ocr', 0.3)

    let words: OcrWord[] = []
    let fullText = ''
    if (canvas.width < MIN_OCR_DIMENSION || canvas.height < MIN_OCR_DIMENSION) {
      warnings.push(
        `Skipped OCR on page ${pageIndex + 1}: rendered size ${canvas.width}x${canvas.height} too small.`
      )
    } else {
      const recognition = await recognizeCanvas(worker, canvas)
      if ('error' in recognition) {
        warnings.push(`OCR warning on page ${pageIndex + 1}: ${recognition.error}`)
      } else {
        words = recognition.words
        fullText = recognition.fullText
        if (fullText.trim()) {
          textSnippets.push(fullText.trim())
        }
      }
    }

    reportProgress(options.onProgress, pageIndex, 'compose', 0.6)

    const imageBytes = await canvasToPngBytes(canvas)
    const widthPt = viewport.width / viewport.scale
    const heightPt = viewport.height / viewport.scale

    const pdfPage = outputPdf.addPage([widthPt, heightPt])
    const embeddedImage = await outputPdf.embedPng(imageBytes)
    pdfPage.drawImage(embeddedImage, { x: 0, y: 0, width: widthPt, height: heightPt })

    const scaleFactor = 1 / viewport.scale
    words.forEach((word) => {
      if (!word.text.trim()) return
      const { x, y, fontSize } = mapWordToPdf(word, scaleFactor, heightPt)
      pdfPage.drawText(word.text.trim(), {
        x,
        y,
        size: fontSize,
        font: embeddedFont,
        color: pdfLib.rgb(1, 1, 1),
        opacity: 0.001,
      })
    })

    destroyCanvas(canvas)

    reportProgress(options.onProgress, pageIndex, 'compose', 1)
  }

  const bytes = await outputPdf.save({ useObjectStreams: false })
  const textPreview = textSnippets.join('\n\n').slice(0, 600)

  return { bytes, textPreview, warnings }
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

function normalizeLanguage(language: string): string {
  const codes = language
    .split('+')
    .map((code) => code.trim().toLowerCase())
    .filter((code) => code.length > 0)
  if (!codes.length) {
    throw new Error('No OCR language provided.')
  }
  const missingCodes = codes.filter((code) => !BUNDLED_LANGUAGES.has(code))
  if (missingCodes.length) {
    const available = Array.from(BUNDLED_LANGUAGES).sort().join(', ')
    throw new Error(
      `OCR language data not bundled for: ${missingCodes.join(', ')}. Available languages: ${available}.`
    )
  }
  return codes.join('+')
}

async function ensureTesseractWorker(language: string): Promise<TesseractWorker> {
  const normalizedLanguage = normalizeLanguage(language)
  if (tesseractWorker) {
    if (workerLanguage !== normalizedLanguage) {
      await tesseractWorker.reinitialize(normalizedLanguage)
      workerLanguage = normalizedLanguage
    }
    return tesseractWorker
  }
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(normalizedLanguage, undefined, {
    workerPath: TESSERACT_WORKER_PATH,
    corePath: TESSERACT_CORE_PATH,
    langPath: TESSERACT_LANG_PATH,
    cachePath: 'tesseract',
  })
  workerLanguage = normalizedLanguage
  tesseractWorker = worker
  return worker
}

async function recognizeCanvas(
  worker: TesseractWorker,
  canvas: HTMLCanvasElement
): Promise<{ words: OcrWord[]; fullText: string } | { error: string }> {
  try {
    const result = await worker.recognize(canvas)
    const words: OcrWord[] = (result?.data?.words ?? [])
      .filter((word) => word.text && word.text.trim().length > 0)
      .filter((word) => word.confidence >= MIN_CONFIDENCE)
      .map((word) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: word.bbox,
      }))

    const fullText = result?.data?.text ?? ''
    return { words, fullText }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    const message = raw.split('\n')[0]?.trim() || raw
    return { error: message }
  }
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value)
      else reject(new Error('Failed to encode canvas to PNG.'))
    }, 'image/png')
  })
  const buffer = await blob.arrayBuffer()
  return new Uint8Array(buffer)
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    throw new Error('Canvas is not available in this environment.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(Math.floor(width), 1)
  canvas.height = Math.max(Math.floor(height), 1)
  return canvas
}

function destroyCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

export function mapWordToPdf(word: OcrWord, scaleFactor: number, pageHeightPt: number) {
  const { x0, y0, x1, y1 } = word.bbox
  const width = (x1 - x0) * scaleFactor
  const height = Math.max((y1 - y0) * scaleFactor, 2)
  const x = x0 * scaleFactor
  const y = pageHeightPt - y1 * scaleFactor
  const fontSize = Math.max(height * 0.9, 4)

  return {
    x,
    y,
    width,
    height,
    fontSize,
  }
}

function reportProgress(
  callback: PdfOcrOptions['onProgress'] | undefined,
  pageIndex: number,
  stage: PdfOcrProgress['stage'],
  progress: number
) {
  callback?.({ pageIndex, stage, progress })
}
