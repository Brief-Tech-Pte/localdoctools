export interface ViewerPoint {
  x: number
  y: number
}

export interface ViewerRect extends ViewerPoint {
  width: number
  height: number
}

export interface PdfRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PdfViewport {
  width: number
  height: number
  scale: number
}

export interface OverlayPointerPayload {
  pointerId: number
  point: ViewerPoint
  originalEvent: PointerEvent
}

export interface TextSelectionPayload {
  overlayRects: ViewerRect[]
  pdfRects: PdfRect[]
}
