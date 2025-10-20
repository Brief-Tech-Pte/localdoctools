import type { Ref } from 'vue'
import type { PdfRect, PdfViewport, ViewerRect } from '../pdfViewerTypes'
import { clamp } from '../utils/clamp'

export interface UseTextSelectionBridgeOptions {
  overlayRef: Ref<HTMLDivElement | null>
  textLayerRef: Ref<HTMLDivElement | null>
  currentViewport: Ref<PdfViewport | null>
  textSelectMode: Ref<boolean>
}

export interface TextSelectionResult {
  overlayRects: ViewerRect[]
  pdfRects: PdfRect[]
}

export function useTextSelectionBridge({
  overlayRef,
  textLayerRef,
  currentViewport,
  textSelectMode,
}: UseTextSelectionBridgeOptions) {
  function handleTextSelectionEnd(callback: (result: TextSelectionResult) => void) {
    if (!textSelectMode.value || !textLayerRef.value || !currentViewport.value) return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return
    const anchorNode = selection.anchorNode
    const focusNode = selection.focusNode
    const layer = textLayerRef.value
    if (!anchorNode || !focusNode) return
    if (!layer.contains(anchorNode) || !layer.contains(focusNode)) return

    const range = selection.rangeCount ? selection.getRangeAt(0) : null
    if (!range) return

    const rectList = range.getClientRects()
    if (!rectList.length) return

    const overlay = overlayRef.value
    if (!overlay) return
    const bounds = overlay.getBoundingClientRect()
    const overlayRects: ViewerRect[] = []
    for (const rect of Array.from(rectList)) {
      const x = clamp(rect.left - bounds.left, 0, currentViewport.value.width)
      const y = clamp(rect.top - bounds.top, 0, currentViewport.value.height)
      const width = clamp(rect.width, 0, currentViewport.value.width - x)
      const height = clamp(rect.height, 0, currentViewport.value.height - y)
      if (width > 1 && height > 1) {
        overlayRects.push({ x, y, width, height })
      }
    }
    if (!overlayRects.length) return

    const merged = mergeLineBoxes(overlayRects)
    const pdfRects: PdfRect[] = []
    for (const rect of merged) {
      const pdfRect = convertOverlayRectToPdf(rect)
      if (pdfRect) {
        pdfRects.push(pdfRect)
      }
    }
    if (!pdfRects.length) return

    callback({ overlayRects: merged, pdfRects })
  }

  function mergeLineBoxes(boxes: ViewerRect[]): ViewerRect[] {
    const tolerance = 3
    const groups: ViewerRect[][] = []
    const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x)
    for (const box of sorted) {
      const group = groups.find((g) => {
        if (!g.length) return false
        return Math.abs(g[0]!.y - box.y) <= tolerance
      })
      if (group) {
        group.push(box)
      } else {
        groups.push([box])
      }
    }
    const merged: ViewerRect[] = []
    for (const group of groups) {
      if (!group.length) continue
      let current: ViewerRect = { ...group[0]! }
      for (let i = 1; i < group.length; i++) {
        const box = group[i]!
        if (box.x <= current.x + current.width + 4) {
          const right = Math.max(current.x + current.width, box.x + box.width)
          current.width = right - current.x
          current.y = Math.min(current.y, box.y)
          current.height = Math.max(current.height, box.height)
        } else {
          merged.push(current)
          current = { ...box }
        }
      }
      merged.push(current)
    }
    return merged
  }

  function convertOverlayRectToPdf(rect: ViewerRect): PdfRect | null {
    if (!currentViewport.value) return null
    const { scale, height } = currentViewport.value
    const width = rect.width / scale
    const heightPoints = rect.height / scale
    const x = rect.x / scale
    const y = (height - (rect.y + rect.height)) / scale
    return { x, y, width, height: heightPoints }
  }

  return {
    handleTextSelectionEnd,
  }
}
