const PLATFORM_KEYS = ['platform', 'osName', 'system', 'uniPlatform']

let cachedInfo = null

function detectFromNavigator() {
  if (typeof navigator === 'undefined') return {}
  const ua = navigator.userAgent || ''
  const lowerUA = ua.toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(lowerUA)
  const isAndroid = /android/.test(lowerUA)
  const system = isIOS ? 'iOS' : (isAndroid ? 'Android' : '')
  return {
    platform: system ? system.toLowerCase() : 'web',
    system,
    brand: navigator.vendor || '',
    model: '',
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
    windowHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
  }
}

export function getSystemInfo(force = false) {
  if (!force && cachedInfo) return cachedInfo

  let info = {}
  try {
    if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
      info = uni.getSystemInfoSync() || {}
    } else if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
      info = wx.getSystemInfoSync() || {}
    } else if (typeof plus !== 'undefined' && plus.os) {
      info = {
        platform: (plus.os.name || '').toLowerCase(),
        system: plus.os.version,
        brand: plus.device?.vendor,
        model: plus.device?.model,
        windowWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
        windowHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
      }
    } else {
      info = detectFromNavigator()
    }
  } catch (err) {
    console.warn('getSystemInfo failed, fallback to navigator:', err)
    info = detectFromNavigator()
  }

  cachedInfo = info || {}
  return cachedInfo
}

export function refreshSystemInfo() {
  cachedInfo = null
  return getSystemInfo(true)
}

function platformString() {
  const info = getSystemInfo() || {}
  const raw = PLATFORM_KEYS.map((key) => String(info?.[key] || '')).find((val) => val)
  return (raw || '').toLowerCase()
}

export function isIOS() {
  const platform = platformString()
  if (platform.includes('ios')) return true
  const sys = String(getSystemInfo()?.system || '').toLowerCase()
  return sys.includes('ios')
}

export function isAndroid() {
  const platform = platformString()
  if (platform.includes('android')) return true
  const sys = String(getSystemInfo()?.system || '').toLowerCase()
  return sys.includes('android')
}

export function isHarmonyOS() {
  const info = getSystemInfo() || {}
  const platform = platformString()
  if (platform.includes('harmony')) return true
  const sys = String(info?.osName || info?.system || '').toLowerCase()
  return sys.includes('harmony') || sys.includes('hongmeng')
}

export function supportsSafeAreaInsets() {
  const info = getSystemInfo() || {}
  return Boolean(info.safeArea || info.safeAreaInsets)
}

export default {
  getSystemInfo,
  refreshSystemInfo,
  isIOS,
  isAndroid,
  isHarmonyOS,
  supportsSafeAreaInsets,
}
