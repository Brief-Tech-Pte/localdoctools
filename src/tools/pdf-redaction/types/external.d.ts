// declare module 'pdf-lib' {
//   export type PDFEmbedder = unknown
//   export const StandardFonts: Record<string, string>
//   export function rgb(r: number, g: number, b: number): unknown
//   export class PDFDocument {
//     static create(): Promise<PDFDocument>
//     static load(data: ArrayBuffer): Promise<PDFDocument>
//     addPage(dimensions?: [number, number]): PDFPage
//     save(options?: { useObjectStreams?: boolean }): Promise<Uint8Array>
//     embedPng(data: ArrayBuffer | Uint8Array): Promise<PDFEmbedder>
//     embedJpg(data: ArrayBuffer | Uint8Array): Promise<PDFEmbedder>
//     embedFont(name: string): Promise<unknown>
//   }
//   export class PDFPage {
//     drawImage(image: PDFEmbedder, options: Record<string, unknown>): void
//     drawText(text: string, options: Record<string, unknown>): void
//   }
// }

// declare module 'pdfjs-dist' {
//   export const GlobalWorkerOptions: { workerPort?: Worker }
//   export function getDocument(options: { data: ArrayBuffer | Uint8Array }): {
//     promise: Promise<PDFDocumentProxy>
//   }

//   export interface PDFDocumentProxy {
//     numPages: number
//     getPage(pageNumber: number): Promise<PDFPageProxy>
//   }

//   export interface PDFPageProxy {
//     getViewport(options: { scale: number }): {
//       width: number
//       height: number
//       viewBox: [number, number, number, number]
//       scale: number
//     }
//     render(parameters: {
//       canvasContext: CanvasRenderingContext2D
//       viewport: unknown
//       transform?: number[]
//     }): {
//       promise: Promise<void>
//       cancel(): void
//     }
//   }
// }

declare module 'pdfjs-dist/build/pdf.worker?worker' {
  const WorkerConstructor: {
    new (): Worker
  }
  export default WorkerConstructor
}

// declare module 'tesseract.js' {
//   export interface RecognizeResult {
//     data: {
//       words: Array<{
//         text: string
//         confidence: number
//         bbox: { x0: number; y0: number; x1: number; y1: number }
//       }>
//       text: string
//     }
//   }

//   export interface CreateWorkerOptions {
//     langPath?: string
//   }

//   export interface TesseractWorker {
//     loadLanguage(lang: string): Promise<void>
//     initialize(lang: string): Promise<void>
//     recognize(image: ImageBitmapSource): Promise<RecognizeResult>
//     terminate(): Promise<void>
//   }

//   export function createWorker(
//     lang?: string,
//     options?: CreateWorkerOptions
//   ): Promise<TesseractWorker>
// }
