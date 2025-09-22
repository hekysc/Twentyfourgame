import { ref, onMounted, onUnmounted } from 'vue'

function extractSafeInsets(sys) {
  const statusHeight = Number.isFinite(sys?.statusBarHeight) ? sys.statusBarHeight : 0
  const safeInsets = sys?.safeAreaInsets || sys?.safeArea || {}
  const safeTop = Number.isFinite(safeInsets?.top) ? safeInsets.top : 0
  const safeBottom = Number.isFinite(safeInsets?.bottom) ? safeInsets.bottom : 0
  return {
    safeTop: safeTop || statusHeight || 0,
    safeBottom: safeBottom || 0,
    windowHeight: Number.isFinite(sys?.windowHeight) ? sys.windowHeight : (Number.isFinite(sys?.screenHeight) ? sys.screenHeight : 0),
  }
}

export function useSafeArea() {
  const safeTop = ref(0)
  const safeBottom = ref(0)
  const windowHeight = ref(0)

  let offResize = null

  function applyInfo(sys) {
    if (!sys || typeof sys !== 'object') return
    const info = extractSafeInsets(sys)
    if (Number.isFinite(info.safeTop)) safeTop.value = info.safeTop
    if (Number.isFinite(info.safeBottom)) safeBottom.value = info.safeBottom
    if (Number.isFinite(info.windowHeight)) windowHeight.value = info.windowHeight
  }

  function fetchSystemInfo() {
    try {
      if (typeof uni !== 'undefined' && typeof uni.getSystemInfo === 'function') {
        uni.getSystemInfo({ success: applyInfo })
        return
      }
      if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
        const sys = uni.getSystemInfoSync()
        applyInfo(sys)
      }
    } catch (_) {
      /* noop */
    }
  }

  onMounted(() => {
    fetchSystemInfo()
    try {
      if (typeof uni !== 'undefined' && typeof uni.onWindowResize === 'function') {
        const handler = (evt) => {
          if (evt && evt.size) applyInfo(evt.size)
          else fetchSystemInfo()
        }
        uni.onWindowResize(handler)
        offResize = () => {
          try { uni.offWindowResize(handler) } catch (_) {}
        }
      }
    } catch (_) {
      offResize = null
    }
  })

  onUnmounted(() => {
    if (typeof offResize === 'function') {
      try { offResize() } catch (_) {}
      offResize = null
    }
  })

  return { safeTop, safeBottom, windowHeight, refreshSafeArea: fetchSystemInfo }
}

export function toPx(value) {
  if (!Number.isFinite(value)) return 0
  return value
}

export function rpxToPx(rpx) {
  if (!Number.isFinite(rpx)) return 0
  try {
    if (typeof uni !== 'undefined' && typeof uni.upx2px === 'function') {
      const px = uni.upx2px(rpx)
      if (Number.isFinite(px)) return px
    }
  } catch (_) {
    /* noop */
  }
  const scale = 0.5
  return rpx * scale
}
