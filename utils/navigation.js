export function exitApp(options = {}) {
  const { fallback } = options || {}

  const attempts = [
    () => {
      try {
        if (typeof plus !== 'undefined' && plus && plus.runtime && typeof plus.runtime.quit === 'function') {
          plus.runtime.quit()
          return true
        }
      } catch (_) {}
      return false
    },
    () => {
      try {
        if (typeof uni !== 'undefined' && uni && typeof uni.exit === 'function') {
          uni.exit()
          return true
        }
      } catch (_) {}
      return false
    },
    () => {
      try {
        if (typeof wx !== 'undefined' && wx && typeof wx.exitMiniProgram === 'function') {
          wx.exitMiniProgram()
          return true
        }
      } catch (_) {}
      return false
    },
  ]

  for (const attempt of attempts) {
    if (attempt()) {
      return true
    }
  }

  let navigated = false
  try {
    if (typeof uni !== 'undefined' && uni && typeof uni.navigateBack === 'function') {
      uni.navigateBack({
        delta: 1,
        success: () => {
          navigated = true
        },
        fail: () => {
          if (!navigated && typeof fallback === 'function') {
            fallback()
          }
        },
        complete: () => {
          if (!navigated && typeof fallback === 'function') {
            fallback()
          }
        },
      })
      return false
    }
  } catch (_) {}

  if (typeof fallback === 'function') {
    fallback()
    return false
  }

  try {
    // #ifndef MP-WEIXIN
    if (typeof window !== 'undefined') {
      if (window.history && window.history.length > 1) {
        window.history.back()
        return false
      }
      if (typeof window.close === 'function') {
        window.close()
        return false
      }
    }
    // #endif
  } catch (_) {}

  return false
}
