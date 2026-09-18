function readSystemInfo() {
  if (typeof uni === 'undefined') return {}
  try {
    if (typeof uni.getDeviceInfo === 'function' && typeof uni.getWindowInfo === 'function') {
      const device = uni.getDeviceInfo() || {}
      const windowInfo = uni.getWindowInfo() || {}
      return { ...device, ...windowInfo }
    }
    if (typeof uni.getSystemInfoSync === 'function') return uni.getSystemInfoSync() || {}
  } catch (e) {
    console.warn('读取系统信息失败:', e)
  }
  return {}
}

export function getSystemInfo() {
  return readSystemInfo()
}

function platformName() {
  const info = readSystemInfo()
  return String(info.osName || info.platform || info.system || '').toLowerCase()
}

export function isIOS() {
  const name = platformName()
  return name.includes('ios') || name.includes('iphone') || name.includes('ipad')
}

export function isAndroid() {
  return platformName().includes('android')
}

export function isHarmonyOS() {
  const name = platformName()
  return name.includes('harmony') || name.includes('ohos')
}
