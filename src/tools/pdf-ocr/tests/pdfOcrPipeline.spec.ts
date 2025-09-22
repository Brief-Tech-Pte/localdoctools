import { describe, expect, it, vi } from 'vitest'

import { mapWordToPdf, MIN_OCR_DIMENSION, recognizeCanvas, shouldSkipOcr } from '../services/pdfOcrPipeline'
import type { OcrWord } from '../types/ocr'

const sampleWord: OcrWord = {
  text: 'Sample',
  confidence: 90,
  bbox: { x0: 100, y0: 200, x1: 220, y1: 260 },
}

describe('mapWordToPdf', () => {
  it('converts image-space bounding boxes to PDF coordinates', () => {
    const scaleFactor = 72 / 300 // 300 DPI rendering back to points
    const pageHeightPt = 792 // 11 inch page

    const result = mapWordToPdf(sampleWord, scaleFactor, pageHeightPt)

    expect(result.x).toBeCloseTo(sampleWord.bbox.x0 * scaleFactor)
    expect(result.width).toBeCloseTo((sampleWord.bbox.x1 - sampleWord.bbox.x0) * scaleFactor)
    const expectedTop = pageHeightPt - sampleWord.bbox.y1 * scaleFactor
    expect(result.y).toBeCloseTo(expectedTop)
    expect(result.fontSize).toBeGreaterThan(4)
  })

  it('enforces minimum height for very small bounding boxes', () => {
    const tinyWord: OcrWord = {
      text: 'i',
      confidence: 75,
      bbox: { x0: 10, y0: 10, x1: 11, y1: 12 },
    }
    const scaleFactor = 1
    const pageHeightPt = 100

    const result = mapWordToPdf(tinyWord, scaleFactor, pageHeightPt)

    expect(result.height).toBeGreaterThanOrEqual(2)
    expect(result.fontSize).toBeGreaterThanOrEqual(4)
  })
})

describe('recognizeCanvas', () => {
  it('filters words by confidence and trims output', async () => {
    const worker = {
      recognize: vi.fn().mockResolvedValue({
        data: {
          text: 'Hello world',
          words: [
            { text: 'Hello', confidence: 95, bbox: { x0: 0, y0: 0, x1: 50, y1: 10 } },
            { text: 'uh', confidence: 10, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
          ],
        },
      }),
    }
    const canvas = document.createElement('canvas')
    const result = await recognizeCanvas(worker as unknown as Parameters<typeof recognizeCanvas>[0], canvas)
    if ('error' in result) throw new Error('Expected success result')
    const { fullText, words } = result
    expect(fullText).toBe('Hello world')
    expect(words).toHaveLength(1)
    expect(words[0]?.text).toBe('Hello')
  })

  it('returns trimmed error message when OCR fails', async () => {
    const worker = {
      recognize: vi.fn().mockRejectedValue(new Error('Image too small to scale!! (2x36 vs min width of 3)\nstack trace')),
    }
    const canvas = document.createElement('canvas')
    const result = await recognizeCanvas(worker as unknown as Parameters<typeof recognizeCanvas>[0], canvas)
    expect(result).toEqual({ error: 'Image too small to scale!! (2x36 vs min width of 3)' })
  })
})

describe('shouldSkipOcr', () => {
  it('returns true if either dimension is below the threshold', () => {
    expect(shouldSkipOcr(MIN_OCR_DIMENSION - 1, 100)).toBe(true)
    expect(shouldSkipOcr(100, MIN_OCR_DIMENSION - 1)).toBe(true)
  })

  it('returns false when dimensions meet the minimum', () => {
    expect(shouldSkipOcr(MIN_OCR_DIMENSION, MIN_OCR_DIMENSION)).toBe(false)
    expect(shouldSkipOcr(MIN_OCR_DIMENSION + 10, MIN_OCR_DIMENSION + 5)).toBe(false)
  })
})
