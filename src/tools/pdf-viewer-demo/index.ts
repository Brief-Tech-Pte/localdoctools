import type { ToolDefinition } from '../types'

export const pdfViewerDemoTool: ToolDefinition = {
  id: 'pdf-viewer-demo',
  label: 'PDF Viewer Demo',
  icon: 'visibility',
  shortDescription: 'Standalone harness to exercise the shared PDF viewer with arbitrary PDFs.',
  maturity: 'experimental',
  route: {
    name: 'pdf-viewer-demo',
    path: 'tools/pdf-viewer-demo',
    component: () => import('./components/PdfViewerDemoPage.vue'),
  },
}
