/* eslint-disable @typescript-eslint/no-explicit-any */
// global.d.ts
declare module '@joplin/turndown-plugin-gfm' {
  export function gfm(service: any): void
}

declare module '@joplin/turndown' {
  import TurndownService from 'turndown'
  export default TurndownService
}

declare module 'markdownlint-rule-helpers' {
  export function applyFixes(md: string, lintResult: any): string
  const helpers: { applyFixes: typeof applyFixes }
  export default helpers
}
