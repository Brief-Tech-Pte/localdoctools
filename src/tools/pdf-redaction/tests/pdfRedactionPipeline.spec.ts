import { describe, expect, it } from 'vitest'

import { buildRedactionSpec, computeFileHash } from '../services/pdfRedactionPipeline'

function createFakeFile(contents: string, name = 'input.pdf') {
  const blob = new Blob([contents], { type: 'application/pdf' })
  return new File([blob], name, { type: 'application/pdf' })
}

describe('pdfRedactionPipeline', () => {
  it('computes a stable SHA-256 hash for the input PDF', async () => {
    const file = createFakeFile('%PDF-1.4\n1 0 obj\nstream\nexample\nendstream\nendobj')
    const hash = await computeFileHash(file)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('builds a redaction spec with ISO timestamp', () => {
    const spec = buildRedactionSpec(
      [
        {
          pageIndex: 0,
          rects: [{ x: 10, y: 10, width: 50, height: 20 }],
          reason: 'test',
        },
      ],
      'abc123'
    )

    expect(spec.pdfHash).toBe('abc123')
    expect(spec.marks).toHaveLength(1)
    expect(new Date(spec.createdAt).toString()).not.toBe('Invalid Date')
  })
})
