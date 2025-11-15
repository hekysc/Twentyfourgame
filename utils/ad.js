// utils/ad.js

// 广告位 ID 配置
// 您需要在此处替换为从 uni-ad 官网和微信小程序后台申请的真实广告位 ID
export const AD_CONFIG = {
  // #ifdef MP-WEIXIN
  rewarded: 'your_weixin_rewarded_ad_id', // 微信小程序激励视频广告位
  banner: 'your_weixin_banner_ad_id',     // 微信小程序 Banner 广告位
  // #endif

  // #ifdef APP-PLUS
  rewarded: 'your_app_rewarded_adpid', // App 端激励视频广告位 ID
  banner: 'your_app_banner_adpid'        // App 端 Banner 广告位 ID
  // #endif
};

// ...（保留其余代码不变）
let _rewardedAd = null;
let _bannerAd = null;
let _adResolve = null;
let _adReject = null;

function createRewardedVideoAd() {
  if (_rewardedAd) {
    _rewardedAd.load(); // 如果实例已存在，尝试重新加载广告
    return;
  }

  _rewardedAd = uni.createRewardedVideoAd({
    adpid: AD_CONFIG.rewarded,
    adUnitId: AD_CONFIG.rewarded // 兼容微信小程序
  });

  _rewardedAd.onLoad(() => {
    console.log('激励视频 广告加载成功');
  });

  _rewardedAd.onClose(res => {
    if (res && res.isEnded) {
      console.log('激励视频 广告播放完成');
      if (_adResolve) _adResolve({ isEnded: true });
    } else {
      console.log('激励视频 广告中途退出');
      if (_adResolve) _adResolve({ isEnded: false });
    }
    _adResolve = null;
    _adReject = null;
  });

  _rewardedAd.onError(err => {
    console.error('激励视频 广告加载失败:', err);
    if (_adReject) _adReject(err);
    _adResolve = null;
    _adReject = null;
  });
}

export function showRewardedAd() {
  if (!_rewardedAd) {
    createRewardedVideoAd();
  }

  return new Promise((resolve, reject) => {
    _adResolve = resolve;
    _adReject = reject;

    _rewardedAd.show().catch(err => {
      console.error('激励视频广告显示前加载失败', err);
      // 尝试重新加载一次
      _rewardedAd.load()
        .then(() => _rewardedAd.show())
        .catch(finalErr => {
          console.error('激励视频广告重试显示失败', finalErr);
          reject(finalErr);
        });
    });
  });
}

export function createBannerAd(adpid) {
    if (_bannerAd) {
        _bannerAd.destroy();
        _bannerAd = null;
    }

    const bannerId = adpid || AD_CONFIG.banner;
    const bannerAd = uni.createBannerAd({
        adpid: bannerId,
        adUnitId: bannerId,
        style: {} // style 让 ad 组件控制
    });

    bannerAd.onError(err => {
        console.error('Banner 广告实例创建失败:', err);
    });

    _bannerAd = bannerAd;
    return bannerAd;
}
