<script>
<<<<<<< HEAD
import {
  ensureUserAvatars
} from './utils/avatar.js'
import {
  scheduleTabWarmup
} from './utils/tab-cache.js'
// 引入我们的 auth 模块
import {
  login,
  isLogged,
  getUserInfo
} from './utils/auth.js'

export default {
  // 定义全局共享数据
  globalData: {
    userInfo: null,
    isLogged: false
  },
  async onLaunch() {
    console.log('App Launch');

    // 自动登录逻辑
    if (isLogged()) {
      console.log('用户已登录，从缓存恢复用户信息');
      this.globalData.userInfo = getUserInfo();
      this.globalData.isLogged = true;
    } else {
      console.log('用户未登录，尝试自动登录');
      try {
        const {
          userInfo
        } = await login();
        this.globalData.userInfo = userInfo;
        this.globalData.isLogged = true;
      } catch (e) {
        console.error('自动登录失败:', e);
        // 即便自动登录失败，也让应用继续运行
        this.globalData.userInfo = null;
        this.globalData.isLogged = false;
      }
    }

    // 监听退出登录事件，清空全局状态
    uni.$on('user-logout', () => {
        this.globalData.userInfo = null;
        this.globalData.isLogged = false;
        console.log('全局状态已清除，用户已退出');
    });

    // --- 保留原有逻辑 ---
    try {
      ensureUserAvatars && ensureUserAvatars().catch(() => {})
    } catch (_) {}
    try {
      scheduleTabWarmup({
        immediate: true
      })
    } catch (_) {}
=======
import { ensureUserAvatars } from './utils/avatar.js'
import { scheduleTabWarmup } from './utils/tab-cache.js'
import { ensureAutoLogin } from './utils/auth.js'

export default {
  onLaunch() {
    try { ensureUserAvatars && ensureUserAvatars().catch(() => {}) } catch (_) {}
    try { scheduleTabWarmup({ immediate: true }) } catch (_) {}
    ensureAutoLogin()
>>>>>>> fa14bfa889a325bfe154c355179004e5920c333b
    try {
      // 仅 App 端支持预加载，H5 忽略
      // #ifdef APP-PLUS
      uni.preloadPage && uni.preloadPage({
        url: '/pages/index/index'
      })
      uni.preloadPage && uni.preloadPage({
        url: '/pages/stats/index'
      })
      uni.preloadPage && uni.preloadPage({
        url: '/pages/user/index'
      })
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
