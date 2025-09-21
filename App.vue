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
  min-height: 100%;
  background: var(--app-bg);
  color: var(--text-primary);
  font-family: var(--font-body);
}

page::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(120% 120% at 10% -10%, rgba(255, 255, 255, 0.45) 0%, transparent 50%),
    radial-gradient(90% 120% at 90% 10%, rgba(255, 154, 197, 0.22) 0%, transparent 65%);
  z-index: -1;
}
</style>
