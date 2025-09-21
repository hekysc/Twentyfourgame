import { onUnmounted } from 'vue'

function getTouchPoint(e) {
  const t = (e && e.touches && e.touches[0]) || (e && e.changedTouches && e.changedTouches[0]) || {}
  const x = t.clientX ?? t.pageX ?? t.x ?? 0
  const y = t.clientY ?? t.pageY ?? t.y ?? 0
  return { x, y }
}

export function useEdgeExit(options = {}) {
  const { showHint, onExit, confirmWindow = 2000, edgeDp = 16 } = options || {}
  const sys = (uni.getSystemInfoSync && uni.getSystemInfoSync()) ? uni.getSystemInfoSync() : {}
  const width = sys.windowWidth || 0
  const pixelRatio = sys.pixelRatio || 1
  const edgePx = Math.max(12, Math.round(edgeDp * (Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1)))

  const state = {
    tracking: false,
    startX: 0,
    startY: 0,
    lastDX: 0,
    lastDY: 0,
    isEdge: false,
  }

  let confirmTimer = null
  let confirmDeadline = 0

  function resetTracking() {
    state.tracking = false
    state.isEdge = false
    state.lastDX = 0
    state.lastDY = 0
  }

  function handleTouchStart(e) {
    const { x, y } = getTouchPoint(e)
    state.tracking = true
    state.startX = x
    state.startY = y
    state.lastDX = 0
    state.lastDY = 0
    state.isEdge = (x <= edgePx) || (width && x >= width - edgePx)
  }

  function handleTouchMove(e) {
    if (!state.tracking) return
    const { x, y } = getTouchPoint(e)
    state.lastDX = x - state.startX
    state.lastDY = y - state.startY
  }

  function attemptExit() {
    const now = Date.now()
    if (confirmTimer && now <= confirmDeadline) {
      clearTimeout(confirmTimer)
      confirmTimer = null
      confirmDeadline = 0
      try { onExit && onExit() } catch (_) {}
      try { uni.$emit && uni.$emit('edge_exit_confirm_exit') } catch (_) {}
      return
    }

    confirmDeadline = now + confirmWindow
    if (confirmTimer) { clearTimeout(confirmTimer); confirmTimer = null }
    confirmTimer = setTimeout(() => {
      confirmTimer = null
      confirmDeadline = 0
    }, confirmWindow)

    if (typeof showHint === 'function') {
      try { uni.$emit && uni.$emit('edge_exit_hint_shown') } catch (_) {}
      showHint('再次从屏幕边缘滑动即可退出', { duration: 2000, interactive: false })
    }
  }

  function handleTouchEnd() {
    if (!state.tracking) return
    const dx = state.lastDX
    const dy = state.lastDY
    const edge = state.isEdge
    resetTracking()
    if (!edge) return
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (absX < 60 || absX <= absY * 1.2) return
    attemptExit()
  }

  function handleTouchCancel() {
    resetTracking()
  }

  onUnmounted(() => {
    if (confirmTimer) { clearTimeout(confirmTimer); confirmTimer = null }
  })

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  }
}
