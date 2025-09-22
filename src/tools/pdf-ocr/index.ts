import type { ToolDefinition } from '../types'

export const pdfOcrTool: ToolDefinition = {
  id: 'pdf-ocr',
  label: 'PDF OCR',
  icon: 'text_snippet',
  shortDescription: 'Make scanned PDFs searchable with in-browser OCR.',
  route: {
    name: 'pdf-ocr',
    path: 'tools/pdf-ocr',
    component: () => import('./components/PdfOcrPage.vue'),
  },
}
