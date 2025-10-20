import { computed, nextTick, ref, watch, type Ref } from 'vue'
import type { PdfViewerEmit, PdfViewport, ViewerPoint } from '../pdfViewerTypes'
import { clamp } from '../../../utils/clamp'

export interface UsePdfOverlayPanOptions {
  overlayRef: Ref<HTMLDivElement | null>
  viewerRef: Ref<HTMLDivElement | null>
  currentViewport: Ref<PdfViewport | null>
  enablePan: Ref<boolean>
  textSelectMode: Ref<boolean>
  emit: PdfViewerEmit
}

export function usePdfOverlayPan({
  overlayRef,
  viewerRef,
  currentViewport,
  enablePan,
  textSelectMode,
  emit,
}: UsePdfOverlayPanOptions) {
  const panOffset = ref({ x: 0, y: 0 })
  const panPointerOrigin = ref({ x: 0, y: 0 })
  const panOffsetOrigin = ref({ x: 0, y: 0 })
  const panBounds = ref({ minX: 0, maxX: 0, minY: 0, maxY: 0 })
  const isPanning = ref(false)
  const overlayPointerId = ref<number | null>(null)

  const canPan = computed(() => enablePan.value && !textSelectMode.value)
  const viewerStyle = computed(() => {
    const { x, y } = panOffset.value
    return {
      transform: `translate3d(${x}px, ${y}px, 0)`,
    }
  })

  watch(canPan, (enabled) => {
    if (!enabled) {
      stopPan()
    }
  })

  watch(
    currentViewport,
    (viewport) => {
      if (!viewport) {
        stopPan()
        panBounds.value = { minX: 0, maxX: 0, minY: 0, maxY: 0 }
        setPanOffset(0, 0)
        return
      }
      void nextTick().then(() => {
        updatePanBounds()
      })
    },
    { flush: 'post' }
  )

  function handleOverlayPointerDown(event: PointerEvent) {
    if (!currentViewport.value || !overlayRef.value) return
    const panIntent = shouldPan(event)
    if (textSelectMode.value && !panIntent) return
    overlayRef.value.setPointerCapture(event.pointerId)
    overlayPointerId.value = event.pointerId
    if (panIntent) {
      startPan(event)
      event.preventDefault()
      return
    }
    if (textSelectMode.value) return
    const point = getRelativePoint(event)
    event.preventDefault()
    emit('overlay-pointer-down', {
      pointerId: event.pointerId,
      point,
      originalEvent: event,
    })
  }

  function handleOverlayPointerMove(event: PointerEvent) {
    if (overlayPointerId.value !== event.pointerId || !currentViewport.value) return
    if (isPanning.value) {
      event.preventDefault()
      updatePan(event)
      return
    }
    if (textSelectMode.value) return
    const point = getRelativePoint(event)
    event.preventDefault()
    emit('overlay-pointer-move', {
      pointerId: event.pointerId,
      point,
      originalEvent: event,
    })
  }

  function handleOverlayPointerUp(event: PointerEvent) {
    if (overlayPointerId.value !== event.pointerId) return
    if (isPanning.value) {
      event.preventDefault()
      endPan()
      releasePointerCapture()
      return
    }
    releasePointerCapture()
    if (textSelectMode.value) return
    const point = getRelativePoint(event)
    event.preventDefault()
    emit('overlay-pointer-up', {
      pointerId: event.pointerId,
      point,
      originalEvent: event,
    })
  }

  function handleOverlayPointerCancel(event: PointerEvent) {
    if (overlayPointerId.value !== event.pointerId) return
    const wasPanning = isPanning.value
    if (wasPanning) {
      endPan()
      event.preventDefault()
    }
    releasePointerCapture()
    if (wasPanning) return
    emit('overlay-pointer-cancel', { pointerId: event.pointerId })
  }

  function shouldPan(event?: PointerEvent) {
    if (!canPan.value) return false
    if (!event) return true
    if (event.pointerType === 'touch' || event.pointerType === 'pen') return true
    if (typeof event.buttons === 'number') {
      return (event.buttons & 1) === 1
    }
    return event.button === 0
  }

  function startPan(event: PointerEvent) {
    isPanning.value = true
    panPointerOrigin.value = { x: event.clientX, y: event.clientY }
    panOffsetOrigin.value = { ...panOffset.value }
  }

  function updatePan(event: PointerEvent) {
    const deltaX = event.clientX - panPointerOrigin.value.x
    const deltaY = event.clientY - panPointerOrigin.value.y
    setPanOffset(panOffsetOrigin.value.x + deltaX, panOffsetOrigin.value.y + deltaY)
  }

  function endPan() {
    if (!isPanning.value) return
    isPanning.value = false
    setPanOffset(panOffset.value.x, panOffset.value.y)
  }

  function stopPan() {
    if (!isPanning.value) return
    isPanning.value = false
    releasePointerCapture()
  }

  function releasePointerCapture() {
    if (overlayPointerId.value !== null && overlayRef.value) {
      try {
        overlayRef.value.releasePointerCapture(overlayPointerId.value)
      } catch (error) {
        console.warn('Failed to release pointer capture', error)
      }
    }
    overlayPointerId.value = null
  }

  function setPanOffset(x: number, y: number) {
    const { minX, maxX, minY, maxY } = panBounds.value
    const clampedX = clamp(x, minX, maxX)
    const clampedY = clamp(y, minY, maxY)
    if (panOffset.value.x === clampedX && panOffset.value.y === clampedY) return
    panOffset.value = { x: clampedX, y: clampedY }
  }

  function updatePanBounds() {
    const viewport = currentViewport.value
    if (!viewport) {
      panBounds.value = { minX: 0, maxX: 0, minY: 0, maxY: 0 }
      setPanOffset(0, 0)
      return
    }
    const containerElement = viewerRef.value?.parentElement ?? viewerRef.value
    if (!containerElement) return
    const containerWidth = containerElement.clientWidth || viewport.width
    const containerHeight = containerElement.clientHeight || viewport.height
    let horizontalPadding = 0
    let verticalPadding = 0
    if (typeof window !== 'undefined') {
      const styles = window.getComputedStyle(containerElement)
      const paddingLeft = parseFloat(styles.paddingLeft || '0')
      const paddingRight = parseFloat(styles.paddingRight || '0')
      const paddingTop = parseFloat(styles.paddingTop || '0')
      const paddingBottom = parseFloat(styles.paddingBottom || '0')
      if (Number.isFinite(paddingLeft) && Number.isFinite(paddingRight)) {
        horizontalPadding = paddingLeft + paddingRight
      }
      if (Number.isFinite(paddingTop) && Number.isFinite(paddingBottom)) {
        verticalPadding = paddingTop + paddingBottom
      }
    }
    const usableWidth = Math.max(containerWidth - horizontalPadding, 0)
    const usableHeight = Math.max(containerHeight - verticalPadding, 0)
    const overflowX = Math.max(viewport.width - usableWidth, 0)
    const overflowY = Math.max(viewport.height - usableHeight, 0)
    const horizontalRange = overflowX / 2
    const verticalRange = overflowY
    panBounds.value = {
      minX: -horizontalRange,
      maxX: horizontalRange,
      minY: -verticalRange,
      maxY: 0,
    }
    setPanOffset(panOffset.value.x, panOffset.value.y)
  }

  function getRelativePoint(event: PointerEvent): ViewerPoint {
    const overlay = overlayRef.value
    const viewport = currentViewport.value
    if (!overlay || !viewport) return { x: 0, y: 0 }
    const bounds = overlay.getBoundingClientRect()
    const x = clamp(event.clientX - bounds.left, 0, viewport.width)
    const y = clamp(event.clientY - bounds.top, 0, viewport.height)
    return { x, y }
  }

  return {
    canPan,
    viewerStyle,
    isPanning,
    handleOverlayPointerDown,
    handleOverlayPointerMove,
    handleOverlayPointerUp,
    handleOverlayPointerCancel,
  }
}
