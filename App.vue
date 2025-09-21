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
  background-color: var(--bg-canvas);
  background-image: var(--bg-canvas-gradient), url('@/static/bg-pattern.svg');
  background-repeat: no-repeat, repeat;
  background-size: cover, 520rpx 520rpx;
  background-position: center, 0 0;
  animation: ambientShift 36s ease-in-out infinite;
  color: var(--text-body);
  transition: background-color 0.3s ease;
}

@keyframes ambientShift {
  0% {
    background-position: center, 0 0;
  }
  50% {
    background-position: center, 220rpx 180rpx;
  }
  100% {
    background-position: center, 0 0;
  }
}
</style>
