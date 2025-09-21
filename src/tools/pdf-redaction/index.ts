import type { ToolDefinition } from '../types'

export const pdfRedactionTool: ToolDefinition = {
  id: 'pdf-redaction',
  label: 'PDF Redaction',
  icon: 'picture_as_pdf',
  shortDescription: 'Mask sensitive content using a raster + OCR pipeline, all in-browser.',
  route: {
    name: 'pdf-redaction',
    path: 'tools/pdf-redaction',
    component: () => import('./components/PdfRedactionPage.vue'),
  },
}
