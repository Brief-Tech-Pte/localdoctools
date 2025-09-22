export interface PdfOcrRequest {
  file: File
  dpi: number
  language: string
}

export interface PdfOcrProgress {
  pageIndex: number
  stage: 'render' | 'ocr' | 'compose'
  progress: number
}

export interface PdfOcrOptions {
  onProgress?: (progress: PdfOcrProgress) => void
}

export interface OcrWord {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export interface OcrPageResult {
  pageIndex: number
  widthPt: number
  heightPt: number
  imageBytes: Uint8Array
  ocrWords: OcrWord[]
}

export interface PdfOcrResult {
  bytes: Uint8Array
  textPreview: string
  warnings: string[]
}
