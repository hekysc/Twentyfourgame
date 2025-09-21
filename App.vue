<script>
import { ensureUserAvatars } from './utils/avatar.js'

export default {
  onLaunch() {
    try { ensureUserAvatars && ensureUserAvatars().catch(() => {}) } catch (_) {}
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
  onHide() {}
}
</script>

<style>
/* 全局样式可放在 uni.scss 中 */
page {
  background-color: #f8f8f8;
}
</style>
