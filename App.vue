<script>
import { ensureUserAvatars } from './utils/avatar.js'
import { scheduleTabWarmup } from './utils/tab-cache.js'

export default {
  onLaunch() {
    try { ensureUserAvatars && ensureUserAvatars().catch(() => {}) } catch (_) {}
    try { scheduleTabWarmup({ immediate: true }) } catch (_) {}
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

/* uni-h5 旧版头部兜底隐藏（仅当 navigationStyle 未生效时） */
.uni-page-head,
.uni-header,
.uni-btn-icon,
.uni-page-head__left,
.uni-page-head__back {
  display: none !important;
}
</style>
