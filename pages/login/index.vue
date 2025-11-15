<template>
  <view
    class="login-page"
    :style="loginPageStyle"
    @touchstart="edgeHandlers.handleTouchStart"
    @touchmove="edgeHandlers.handleTouchMove"
    @touchend="edgeHandlers.handleTouchEnd"
    @touchcancel="edgeHandlers.handleTouchCancel"
  >
    <AppNavBar title="无敌24点程序·观测" :showBack="false" :with-safe-top="false" />

    <!-- 主体 -->
    <view class="login-body">
      <view class="login-heading">
        <text class="h1">{{ currentUser ? '当前用户' : '欢迎来到24点' }}</text>
      </view>

      <!-- 当前用户信息 -->
      <view v-if="currentUser" class="current-user-card card section">
        <image v-if="currentUser.avatar_url" class="avatar-img" :src="currentUser.avatar_url" mode="aspectFill" />
        <view v-else class="avatar" :style="{ backgroundColor: userColor }">{{ avatarText(currentUser.nickname) }}</view>
        <view class="user-col">
          <view class="user-name">{{ currentUser.nickname || '微信用户' }}</view>
          <view class="user-sub">上次登录：{{ lastLoginText(currentUser.last_login_at) }}</view>
        </view>
        <button class="btn-outline" @tap="editProfile">编辑</button>
      </view>

      <!-- 微信登录按钮 -->
      <view v-if="!currentUser" class="login-actions">
        <button 
          v-if="isMpWeixin" 
          class="wx-login-btn primary" 
          @tap="handleWxLogin"
          :disabled="loginLoading"
        >
          <text class="wx-icon">🟢</text>
          <text>{{ loginLoading ? '登录中...' : '微信快速登录' }}</text>
        </button>
        
        <button 
          v-if="isApp" 
          class="app-login-btn primary" 
          @tap="handleAppLogin"
          :disabled="loginLoading"
        >
          <text class="app-icon">📱</text>
          <text>{{ loginLoading ? '登录中...' : '设备登录' }}</text>
        </button>

        <button 
          v-if="!isMpWeixin && !isApp" 
          class="guest-login-btn secondary" 
          @tap="handleGuestLogin"
        >
          <text class="guest-icon">👤</text>
          <text>游客体验</text>
        </button>
      </view>

      <!-- 操作按钮 -->
      <view v-if="currentUser" class="action-buttons">
        <button class="btn primary" @tap="goToGame">开始游戏</button>
        <button class="btn secondary" @tap="logout">退出登录</button>
      </view>

      <!-- 数据迁移提示 -->
      <view v-if="showMigrationPrompt" class="migration-prompt card section">
        <text class="migration-title">数据迁移</text>
        <text class="migration-text">检测到本地游戏数据，是否迁移到云端？</text>
        <view class="migration-buttons">
          <button class="btn-outline" @tap="skipMigration">跳过</button>
          <button class="btn primary" @tap="performMigration">迁移数据</button>
        </view>
      </view>
    </view>

    <!-- 提示信息 -->
    <view
      v-if="hintState.visible"
      class="floating-hint-layer"
      :class="{ interactive: hintState.interactive }"
      @tap="hideHint"
    >
      <view class="floating-hint" @tap.stop>{{ hintState.text }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onBackPress, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { 
  ensureInit, 
  getCurrentUser, 
  updateUserProfile, 
  resetAllData,
  migrateLocalData,
  resetUserData
} from '../../utils/cloud-store.js'
import { 
  wxLogin, 
  appLogin, 
  getWxProfileAndUpdate, 
  ensureAutoLogin,
  clearSession
} from '../../utils/auth.js'
import { useFloatingHint } from '../../utils/hints.js'
import { useEdgeExit } from '../../utils/edge-exit.js'
import { exitApp } from '../../utils/navigation.js'
import { useSafeArea } from '../../utils/useSafeArea.js'
import { getSystemInfo } from '../../utils/system-compat.js'
import AppNavBar from '../../components/AppNavBar.vue'

const currentUser = ref(null)
const loginLoading = ref(false)
const showMigrationPrompt = ref(false)
const userColor = ref('#e2e8f0')

const { hintState, showHint, hideHint } = useFloatingHint()
const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitLoginPage() })

// 检测平台
const isMpWeixin = computed(() => {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  return false
})

const isApp = computed(() => {
  // #ifdef APP-PLUS
  return true
  // #endif
  return false
})

const { safeTop } = useSafeArea()
const loginPageStyle = computed(() => ({ paddingTop: `${Math.max(0, safeTop.value || 0)}px` }))

let lastBackPress = 0
onBackPress(() => {
  const now = Date.now()
  if (now - lastBackPress < 2000) {
    exitLoginPage()
  } else {
    lastBackPress = now
    try {
      showHint('再按一次返回退出应用', { duration: 2000, interactive: false })
    } catch (_) {
      uni.showToast({ title: '再按一次退出应用', icon: 'none' })
    }
  }
  return true
})

onMounted(async () => {
  await ensureInit()
  await loadCurrentUser()
  checkForMigration()
  try { updateVHVar() } catch(_) {}
  if (uni.onWindowResize) uni.onWindowResize(() => { try { updateVHVar() } catch(_) {} })
})

function updateVHVar(){
  try {
    const sys = getSystemInfo()
    const h = sys.windowHeight || (typeof window !== 'undefined' ? window.innerHeight : 0) || 0
    // #ifndef MP-WEIXIN
    if (h && typeof document !== 'undefined' && document.documentElement && document.documentElement.style) {
      document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px')
    }
    // #endif
  } catch (_) { /* noop */ }
}

async function loadCurrentUser() {
  try {
    currentUser.value = await getCurrentUser()
    if (currentUser.value) {
      // 设置用户颜色
      userColor.value = currentUser.value.settings?.color || generateUserColor()
    }
  } catch (err) {
    console.error('获取用户信息失败:', err)
    showHint('获取用户信息失败', { duration: 2000 })
  }
}

function generateUserColor() {
  const palette = ['#e2e8f0', '#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca', '#f5d0fe', '#c7d2fe']
  return palette[Math.floor(Math.random() * palette.length)]
}

async function handleWxLogin() {
  if (loginLoading.value) return
  
  loginLoading.value = true
  try {
    // 微信登录
    await wxLogin()
    showHint('登录成功', { duration: 1500 })
    
    // 重新加载用户信息
    await loadCurrentUser()
    
    // 尝试获取用户详细信息
    try {
      await getWxProfileAndUpdate()
      await loadCurrentUser()
    } catch (err) {
      console.warn('获取用户详细信息失败:', err)
    }
    
    // 登录成功后跳转到游戏页面
    setTimeout(() => {
      goToGame()
    }, 1000)
  } catch (err) {
    console.error('微信登录失败:', err)
    showHint('登录失败，请重试', { duration: 2000 })
  } finally {
    loginLoading.value = false
  }
}

async function handleAppLogin() {
  if (loginLoading.value) return
  
  loginLoading.value = true
  try {
    // App登录
    await appLogin()
    showHint('登录成功', { duration: 1500 })
    
    // 重新加载用户信息
    await loadCurrentUser()
    
    // 登录成功后跳转到游戏页面
    setTimeout(() => {
      goToGame()
    }, 1000)
  } catch (err) {
    console.error('App登录失败:', err)
    showHint('登录失败，请重试', { duration: 2000 })
  } finally {
    loginLoading.value = false
  }
}

function handleGuestLogin() {
  showHint('游客模式功能有限，请使用完整登录', { duration: 3000 })
}

function goToGame() {
  try {
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (_) {
    try {
      uni.switchTab({ url: '/pages/index/index' })
    } catch (_) {}
  }
}

function exitLoginPage() {
  exitApp({
    fallback: () => {
      try {
        uni.navigateBack({ delta: 1 })
      } catch (_) {
        try {
          uni.reLaunch({ url: '/pages/index/index' })
        } catch (_) {}
      }
    }
  })
}

async function logout() {
  uni.showModal({
    title: '确认退出',
    content: '退出登录后，本地游戏数据仍会保留',
    success: async (res) => {
      if (res.confirm) {
        clearSession()
        currentUser.value = null
        showHint('已退出登录', { duration: 1500 })
      }
    }
  })
}

async function editProfile() {
  uni.showActionSheet({
    itemList: ['修改昵称', '修改头像', '返回'],
    success: async (res) => {
      switch (res.tapIndex) {
        case 0:
          editNickname()
          break
        case 1:
          editAvatar()
          break
        case 2:
          break
      }
    }
  })
}

function editNickname() {
  uni.showModal({
    title: '修改昵称',
    editable: true,
    placeholderText: '请输入新昵称',
    success: async (res) => {
      if (res.confirm && res.content) {
        const nickname = String(res.content).trim()
        if (nickname && nickname.length >= 1 && nickname.length <= 20) {
          try {
            await updateUserProfile({ nickname })
            currentUser.value.nickname = nickname
            showHint('昵称修改成功', { duration: 1500 })
          } catch (err) {
            showHint('修改失败，请重试', { duration: 2000 })
          }
        } else {
          showHint('昵称长度应为1-20个字符', { duration: 2000 })
        }
      }
    }
  })
}

function editAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: async (res) => {
      const tempFilePath = (res.tempFilePaths && res.tempFilePaths[0]) || ''
      if (tempFilePath) {
        try {
          // 这里应该上传图片到云存储，简化处理直接使用临时路径
          await updateUserProfile({ avatar_url: tempFilePath })
          currentUser.value.avatar_url = tempFilePath
          showHint('头像修改成功', { duration: 1500 })
        } catch (err) {
          showHint('头像上传失败，请重试', { duration: 2000 })
        }
      }
    },
    fail: () => {
      showHint('选择图片失败', { duration: 1500 })
    }
  })
}

function checkForMigration() {
  // 检查是否有本地数据需要迁移
  try {
    const localData = uni.getStorageSync('tf24_users_v1')
    if (localData && currentUser.value) {
      showMigrationPrompt.value = true
    }
  } catch (err) {
    // 没有本地数据或读取失败
  }
}

async function skipMigration() {
  showMigrationPrompt.value = false
}

async function performMigration() {
  try {
    showHint('开始迁移数据...', { duration: 1500 })
    const result = await migrateLocalData()
    
    if (result.migrated) {
      showHint('数据迁移成功！', { duration: 2000 })
    } else {
      showHint(result.message || '迁移失败', { duration: 2000 })
    }
  } catch (err) {
    showHint('迁移失败，请重试', { duration: 2000 })
  } finally {
    showMigrationPrompt.value = false
  }
}

function avatarText(name) {
  if (!name) return '用'
  return name.charAt(0).toUpperCase()
}

function lastLoginText(timestamp) {
  if (!timestamp) return '首次登录'
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
  if (diff < 30 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`
  
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 分享功能
onShareAppMessage(() => {
  return {
    title: '来玩24点数学游戏吧！',
    path: '/pages/login/index',
    imageUrl: ''
  }
})

onShareTimeline(() => {
  return {
    title: '24点数学游戏 - 挑战你的数学思维',
    imageUrl: ''
  }
})
</script>

<style scoped>
@import '@/styles/common.css';

:root {
  --primary-color: #145751;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --bg-primary: #ffffff;
  --shadow-md: 0 6rpx 16rpx rgba(0,0,0,0.06);
  --radius-lg: 16rpx;
  --radius-xl: 20rpx;
  --radius-full: 50%;
}

.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
  padding-bottom: 40rpx;
}

.login-body {
  padding: 40rpx 32rpx;
}

.login-heading {
  text-align: center;
  margin-bottom: 60rpx;
  .h1 {
    font-size: 48rpx;
    font-weight: bold;
    color: var(--text-primary);
  }
}

.current-user-card {
  display: flex;
  align-items: center;
  padding: 40rpx;
  margin-bottom: 40rpx;
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  
  .avatar-img {
    width: 100rpx;
    height: 100rpx;
    border-radius: var(--radius-full);
    margin-right: 30rpx;
  }
  
  .avatar {
    width: 100rpx;
    height: 100rpx;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    font-weight: bold;
    color: #fff;
    margin-right: 30rpx;
  }
  
  .user-col {
    flex: 1;
    
    .user-name {
      font-size: 36rpx;
      font-weight: bold;
      color: var(--text-primary);
      margin-bottom: 10rpx;
    }
    
    .user-sub {
      font-size: 28rpx;
      color: var(--text-secondary);
    }
  }
  
  .btn-outline {
    padding: 16rpx 32rpx;
    border: 2rpx solid var(--primary-color);
    border-radius: 32rpx;
    background: transparent;
    color: var(--primary-color);
    font-size: 28rpx;
  }
}

.login-actions {
  margin-bottom: 40rpx;
}

.wx-login-btn, .app-login-btn, .guest-login-btn {
  width: 100%;
  height: 100rpx;
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 30rpx;
  
  &.primary {
    background: var(--primary-color);
    color: #fff;
  }
  
  &.secondary {
    background: #f0f0f0;
    color: var(--text-primary);
  }
  
  .wx-icon, .app-icon, .guest-icon {
    font-size: 36rpx;
    margin-right: 20rpx;
  }
}

.action-buttons {
  display: flex;
  gap: 30rpx;
  margin-top: 40rpx;
  
  .btn {
    flex: 1;
    height: 88rpx;
    border-radius: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    font-weight: bold;
    
    &.primary {
      background: var(--primary-color);
      color: #fff;
    }
    
    &.secondary {
      background: #f0f0f0;
      color: var(--text-primary);
    }
  }
}

.migration-prompt {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  padding: 40rpx;
  margin-top: 40rpx;
  box-shadow: var(--shadow-md);
  
  .migration-title {
    font-size: 32rpx;
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 20rpx;
    display: block;
  }
  
  .migration-text {
    font-size: 28rpx;
    color: var(--text-secondary);
    margin-bottom: 30rpx;
    display: block;
  }
  
  .migration-buttons {
    display: flex;
    gap: 20rpx;
    
    button {
      flex: 1;
      height: 80rpx;
      border-radius: 40rpx;
      font-size: 28rpx;
      font-weight: bold;
    }
  }
}

.floating-hint-layer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  
  &.interactive {
    pointer-events: auto;
  }
  
  .floating-hint {
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 24rpx 40rpx;
    border-radius: 12rpx;
    font-size: 28rpx;
    max-width: 80%;
    text-align: center;
  }
}
</style>