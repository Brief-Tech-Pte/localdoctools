import mammoth from 'mammoth'
import TurndownService from '@joplin/turndown'
import { gfm } from '@joplin/turndown-plugin-gfm'
import { parse } from 'node-html-parser'

/**
 * DOCX to Markdown conversion service.
 *
 * Mirrors the logic of benbalter/word-to-markdown-js with a browser-friendly API.
 */

export interface ConvertOptions {
  /** Inline images as data URLs in Markdown. Default: true */
  inlineImages?: boolean
  /** Override Mammoth options. `styleMap` merges with `styleMap`/`inlineImages`. */
  mammoth?: Record<string, unknown>
  /** Optional Mammoth style map overrides. */
  styleMap?: string[]
  /** Optional Turndown options (subset). */
  turndown?: TurndownOptions
  /** Disable the markdown linting/cleanup step. */
  lint?: boolean
}

export interface TurndownOptions {
  headingStyle?: 'setext' | 'atx'
  codeBlockStyle?: 'indented' | 'fenced'
  bulletListMarker?: '*' | '-' | '+'
  emDelimiter?: '_' | '*'
}

const defaultStyleMap = [
  'p[style-name="Title"] => h1:fresh',
  'p[style-name="Subtitle"] => h2:fresh',
]

const defaultTurndownOptions: TurndownOptions = {
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
}

type MammothInput = Parameters<typeof mammoth.convertToHtml>[0]

function autoTableHeaders(html: string): string {
  const root = parse(html)
  root.querySelectorAll('table').forEach((table) => {
    const firstRow = table.querySelector('tr')
    if (!firstRow) return
    firstRow.querySelectorAll('td').forEach((cell) => {
      cell.tagName = 'th'
    })
  })
  return root.toString()
}

function htmlToMd(html: string, options: TurndownOptions = {}): string {
  const turndownService = new TurndownService({
    ...options,
    ...defaultTurndownOptions,
  })
  turndownService.use(gfm)
  return turndownService.turndown(html).trim()
}

async function lintMarkdown(md: string, enabled: boolean): Promise<string> {
  if (!enabled) return md.trim()
  try {
    const [markdownlintModule, helpersModule] = await Promise.all([
      import('markdownlint'),
      import('markdownlint-rule-helpers'),
    ])
    const markdownlint = markdownlintModule.default ?? markdownlintModule
    const helpers = helpersModule.default ?? helpersModule
    const lintResult = markdownlint.sync({ strings: { md } })
    const fixed = helpers.applyFixes(md, lintResult['md'])
    return (fixed ?? md).trim()
  } catch (error) {
    console.warn('Markdown linting skipped:', error)
    return md.trim()
  }
}

function buildMammothOptions(opts: ConvertOptions): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ...(opts.mammoth ?? {}),
  }
  const styleMap =
    opts.styleMap ?? (opts.mammoth?.styleMap as string[] | undefined) ?? defaultStyleMap
  base.styleMap = styleMap

  const shouldInlineImages = opts.inlineImages ?? true
  if (shouldInlineImages && !base.convertImage) {
    // base.convertImage = mammoth.images.inline(async (element: any) => {
    //   const buffer = await element.read('base64')
    //   const contentType = element.contentType
    //   return { src: `data:${contentType};base64,${buffer}` }
    // })
  }

  return base
}

/**
 * Convert a DOCX source (buffer/path) to Markdown.
 */
export async function convertDocxArrayBufferToMarkdown(
  input: MammothInput,
  opts: ConvertOptions = {}
): Promise<string> {
  const mammothOptions = buildMammothOptions(opts)
  const mammothResult = await mammoth.convertToHtml(input, mammothOptions)
  const html = autoTableHeaders(mammothResult.value ?? '')
  const md = htmlToMd(html, opts.turndown)
  const linted = await lintMarkdown(md, opts.lint !== false)
  return linted
}

/**
 * Convenience wrapper to convert a File to Markdown.
 */
export async function convertDocxFileToMarkdown(
  file: File,
  opts?: ConvertOptions
): Promise<string> {
  const buffer = await file.arrayBuffer()
  return convertDocxArrayBufferToMarkdown({ arrayBuffer: buffer }, opts)
}
