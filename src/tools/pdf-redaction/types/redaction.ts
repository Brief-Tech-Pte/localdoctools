export interface RedactionRect {
  x: number
  y: number
  width: number
  height: number
}

export interface RedactionMark {
  pageIndex: number
  rects: RedactionRect[]
  reason?: string
}

export interface RedactionSpec {
  marks: RedactionMark[]
  pdfHash: string
  createdAt: string
}

export interface OcrWordBox {
  text: string
  confidence: number
  /** Bounding box in PDF points (origin bottom-left). */
  bbox: { x: number; y: number; width: number; height: number }
}

export interface ProcessedPageResult {
  pageIndex: number
  widthPt: number
  heightPt: number
  imageBytes: Uint8Array
  imageType: 'image/png' | 'image/jpeg'
  ocrWords: OcrWordBox[]
}

export interface PdfRedactionRequest {
  file: File
  spec: RedactionSpec
  dpi: number
}

export interface PdfRedactionProgress {
  pageIndex: number
  stage: 'render' | 'mask' | 'ocr' | 'compose'
  progress: number
}

export interface PdfRedactionWorkerMessage {
  type: 'progress'
  payload: PdfRedactionProgress
}
