import type { ToolDefinition } from '../types'

export const wordToMarkdownTool: ToolDefinition = {
  id: 'word-to-markdown',
  label: 'Word → Markdown',
  icon: 'description',
  shortDescription: 'Convert DOCX documents to Markdown locally.',
  maturity: 'stable',
  route: {
    name: 'word-to-markdown',
    path: 'tools/word-to-markdown',
    component: () => import('./components/WordToMarkdownPage.vue'),
  },
}
