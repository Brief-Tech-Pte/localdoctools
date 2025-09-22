declare module 'pdfjs-dist/web/pdf_viewer' {
  export class EventBus {
    constructor()
  }
  export class TextLayerBuilder {
    constructor(opts: {
      textLayerDiv: HTMLDivElement
      pageIndex: number
      viewport: unknown
      eventBus: EventBus
      enhanceTextSelection: boolean
    })
    setTextContent(content: unknown): void
    render(): Promise<void>
  }
}
