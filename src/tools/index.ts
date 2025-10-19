import type { RouteRecordRaw } from 'vue-router'
import type { ToolDefinition } from './types'
import { wordToMarkdownTool } from './word-to-markdown'
import { pdfRedactionTool } from './pdf-redaction'
import { pdfOcrTool } from './pdf-ocr'
import { pdfViewerDemoTool } from './pdf-viewer-demo'

export const tools: ToolDefinition[] = [
  wordToMarkdownTool,
  pdfRedactionTool,
  pdfOcrTool,
  pdfViewerDemoTool,
]

export const toolRoutes: RouteRecordRaw[] = tools.map(({ route }) => ({
  path: route.path,
  name: route.name,
  component: route.component,
}))
