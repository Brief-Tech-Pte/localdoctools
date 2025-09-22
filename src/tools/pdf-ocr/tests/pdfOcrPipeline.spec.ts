import { describe, expect, it } from 'vitest'

import { mapWordToPdf } from '../services/pdfOcrPipeline'
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
