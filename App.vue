<script>
import { ensureUserAvatars } from './utils/avatar.js'
import { scheduleTabWarmup } from './utils/tab-cache.js'
import { ensureAutoLogin } from './utils/auth.js'

export default {
  onLaunch() {
    try { ensureUserAvatars && ensureUserAvatars().catch(() => {}) } catch (_) {}
    try { scheduleTabWarmup({ immediate: true }) } catch (_) {}
    ensureAutoLogin()
    try {
      // 仅 App 端支持预加载，H5 忽略
      // #ifdef APP-PLUS
      uni.preloadPage && uni.preloadPage({ url: '/pages/index/index' })
      uni.preloadPage && uni.preloadPage({ url: '/pages/stats/index' })
      uni.preloadPage && uni.preloadPage({ url: '/pages/user/index' })
      // #endif
    } catch (e) {}
  },
  onShow() {},
  onHide() {},
  // 全局分享给好友
  onShareAppMessage() {
    return {
      title: '24点游戏小程序 - 挑战你的计算能力！',
      path: '/pages/index/index',
      imageUrl: '' // 使用系统默认截图或小程序logo
    }
  },
  // 全局分享到朋友圈
  onShareTimeline() {
    return {
      title: '24点游戏小程序 - 挑战你的计算能力！',
      query: '',
      imageUrl: '' // 使用系统默认截图或小程序logo
    }
  }
}
</script>

<style>
/* 全局样式可放在 uni.scss 中 */
page {
  background-color: #f8f8f8;
}

/* uni-h5 旧版头部兜底隐藏（仅当 navigationStyle 未生效时） */
.uni-page-head,
.uni-header,
.uni-btn-icon,
.uni-page-head__left,
.uni-page-head__back {
  display: none !important;
}
</style>
