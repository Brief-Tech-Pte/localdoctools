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

export interface ViewportDimensions {
  width: number
  height: number
  canvasWidth: number
  canvasHeight: number
  widthRatio: number
  heightRatio: number
}

export type CanvasLoadedCallback = (
  canvasElement: HTMLCanvasElement,
  viewport: ViewportDimensions
) => void

export interface OverlayPointerPayload {
  pointerId: number
  point: ViewerPoint
  originalEvent: PointerEvent
}

export interface TextSelectionPayload {
  overlayRects: ViewerRect[]
  pdfRects: PdfRect[]
}

export interface PdfViewerEmit {
  (event: 'document-loaded', payload: { pageCount: number }): void
  (event: 'document-unloaded'): void
  (event: 'rendered', payload: { viewport: PdfViewport }): void
  (event: 'load-error', payload: { error: unknown }): void
  (event: 'render-error', payload: { error: unknown }): void
  (event: 'overlay-pointer-down', payload: OverlayPointerPayload): void
  (event: 'overlay-pointer-move', payload: OverlayPointerPayload): void
  (event: 'overlay-pointer-up', payload: OverlayPointerPayload): void
  (event: 'overlay-pointer-cancel', payload: { pointerId: number }): void
  (event: 'text-selection', payload: TextSelectionPayload): void
  (event: 'scale-change', payload: { scale: number; isAuto: boolean }): void
}
