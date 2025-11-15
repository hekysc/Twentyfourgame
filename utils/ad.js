const WX_BANNER_ID = 'adunit-wx-banner-demo'
const WX_REWARD_ID = 'adunit-wx-reward-demo'
const APP_BANNER_ID = 'adunit-app-banner-demo'
const APP_REWARD_ID = 'adunit-app-reward-demo'

function getPlatformIds() {
  // #ifdef MP-WEIXIN
  return { banner: WX_BANNER_ID, rewarded: WX_REWARD_ID }
  // #endif
  // #ifdef APP-PLUS
  // #ifdef APP-ANDROID
  return { banner: APP_BANNER_ID, rewarded: APP_REWARD_ID, platform: 'app-android' }
  // #endif
  // #ifdef APP-IOS
  return { banner: APP_BANNER_ID, rewarded: APP_REWARD_ID, platform: 'app-ios' }
  // #endif
  // #ifdef APP-HARMONY
  return { banner: APP_BANNER_ID, rewarded: APP_REWARD_ID, platform: 'app-harmony' }
  // #endif
  return { banner: APP_BANNER_ID, rewarded: APP_REWARD_ID }
  // #endif
  return { banner: '', rewarded: '' }
}

export function showBannerAd(options = {}) {
  const ids = getPlatformIds()
  if (!ids.banner) {
    console.warn('当前平台未配置 banner 广告')
    return null
  }
  let banner = null
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && wx.createBannerAd) {
    banner = wx.createBannerAd({
      adUnitId: ids.banner,
      style: {
        left: 0,
        top: 0,
        width: options.width || 320
      }
    })
  }
  // #endif
  // #ifdef APP-PLUS
  if (uni.createBannerAd) {
    banner = uni.createBannerAd({ adUnitId: ids.banner })
  }
  // #endif
  if (banner) {
    banner.onError && banner.onError((err) => console.warn('banner error', err))
    banner.onLoad && banner.onLoad(() => console.log('banner loaded'))
    banner.show && banner.show()
  }
  return banner
}

export function showRewardedAd({ onReward } = {}) {
  const ids = getPlatformIds()
  if (!ids.rewarded) {
    console.warn('当前平台未配置激励视频')
    return Promise.resolve({ success: false })
  }
  return new Promise((resolve) => {
    let rewarded
    // #ifdef MP-WEIXIN
    if (typeof wx !== 'undefined' && wx.createRewardedVideoAd) {
      rewarded = wx.createRewardedVideoAd({ adUnitId: ids.rewarded })
    }
    // #endif
    // #ifdef APP-PLUS
    if (!rewarded && typeof uni.createRewardedVideoAd === 'function') {
      rewarded = uni.createRewardedVideoAd({ adUnitId: ids.rewarded })
    }
    // #endif
    if (!rewarded) {
      resolve({ success: false })
      return
    }
    rewarded.onClose && rewarded.onClose((res) => {
      const success = res && res.isEnded !== false
      if (success && typeof onReward === 'function') {
        onReward()
      }
      resolve({ success })
      rewarded.offClose && rewarded.offClose()
      rewarded.destroy && rewarded.destroy()
    })
    rewarded.onError && rewarded.onError((err) => {
      console.warn('rewarded error', err)
      resolve({ success: false, error: err })
    })
    rewarded.show && rewarded.show().catch(() => rewarded.load && rewarded.load().then(() => rewarded.show()))
  })
}

export function getBannerUnitId() {
  return getPlatformIds().banner
}

export function getRewardUnitId() {
  return getPlatformIds().rewarded
}
