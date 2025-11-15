<template>
  <view 
    class="page"
    :style="pageStyle"
    @touchstart="edgeHandlers.handleTouchStart"
    @touchmove="edgeHandlers.handleTouchMove"
    @touchend="edgeHandlers.handleTouchEnd"
    @touchcancel="edgeHandlers.handleTouchCancel"
  >
    <AppNavBar title="用户管理" :show-back="true" :with-safe-top="false" :back-to-index="true" />
    
    <!-- 当前用户信息 -->
    <view v-if="currentUser" class="current-user-card card section">
      <image v-if="currentUser.avatar_url" class="avatar-img" :src="currentUser.avatar_url" mode="aspectFill" />
      <view v-else class="avatar" :style="{ backgroundColor: userColor }">{{ avatarText(currentUser.nickname) }}</view>
      <view class="user-info">
        <view class="user-name">{{ currentUser.nickname || '微信用户' }}</view>
        <view class="user-stats">
          <text class="stat-item">总场次: {{ userStats?.totals?.total || 0 }}</text>
          <text class="stat-item">胜率: {{ winRate }}%</text>
        </view>
      </view>
      <button class="btn btn-outline" @tap="editProfile">编辑资料</button>
    </view>
    
    <!-- 未登录状态 -->
    <view v-else class="not-logged-in card section">
      <text class="login-prompt">请先登录后查看用户信息</text>
      <button class="btn btn-primary" @tap="goToLogin">立即登录</button>
    </view>
    
    <!-- 功能操作 -->
    <view v-if="currentUser" class="operations">
      <view class="operation-group">
        <text class="group-title">数据管理</text>
        <button class="operation-btn" @tap="viewDetailedStats">
          <text class="btn-icon">📊</text>
          <text class="btn-text">详细统计</text>
        </button>
        <button class="operation-btn" @tap="exportData">
          <text class="btn-icon">📤</text>
          <text class="btn-text">导出数据</text>
        </button>
        <button class="operation-btn danger" @tap="confirmResetData">
          <text class="btn-icon">🗑️</text>
          <text class="btn-text">重置数据</text>
        </button>
      </view>
      
      <view class="operation-group">
        <text class="group-title">账号设置</text>
        <button class="operation-btn" @tap="changeAvatar">
          <text class="btn-icon">🖼️</text>
          <text class="btn-text">更换头像</text>
        </button>
        <button class="operation-btn" @tap="changeNickname">
          <text class="btn-icon">✏️</text>
          <text class="btn-text">修改昵称</text>
        </button>
        <button class="operation-btn" @tap="changeColor">
          <text class="btn-icon">🎨</text>
          <text class="btn-text">主题颜色</text>
        </button>
      </view>
      
      <view class="operation-group">
        <text class="group-title">其他</text>
        <button class="operation-btn" @tap="logout">
          <text class="btn-icon">🚪</text>
          <text class="btn-text">退出登录</text>
        </button>
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
import { ref, onMounted, computed } from 'vue'
import { onBackPress, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import AppNavBar from '../../components/AppNavBar.vue'
import { 
  getCurrentUser, 
  readStats, 
  updateUserProfile,
  setUserAvatar,
  setUserNickname,
  setUserColor,
  resetUserData
} from '../../utils/cloud-store.js'
import { clearSession } from '../../utils/auth.js'
import { useFloatingHint } from '../../utils/hints.js'
import { useEdgeExit } from '../../utils/edge-exit.js'
import { navigateToHome } from '../../utils/navigation.js'
import { useSafeArea, rpxToPx } from '../../utils/useSafeArea.js'

const currentUser = ref(null)
const userStats = ref(null)
const userColor = ref('#e2e8f0')

const { hintState, showHint, hideHint } = useFloatingHint()
const edgeHandlers = useEdgeExit({ showHint, onExit: () => navigateToHome() })

const { safeTop } = useSafeArea()
const pageStyle = computed(() => ({
  paddingTop: `${Math.max(0, safeTop.value || 0)}px`
}))

const winRate = computed(() => {
  if (!userStats.value?.totals?.total) return 0
  return Math.round((userStats.value.totals.success / userStats.value.totals.total) * 100)
})

onMounted(async () => {
  await loadUserData()
})

onShow(async () => {
  await loadUserData()
})

async function loadUserData() {
  try {
    currentUser.value = await getCurrentUser()
    if (currentUser.value) {
      userColor.value = currentUser.value.settings?.color || '#e2e8f0'
      userStats.value = await readStats()
    }
  } catch (err) {
    console.error('加载用户数据失败:', err)
    showHint('加载用户数据失败', { duration: 2000 })
  }
}

function goToLogin() {
  uni.reLaunch({ url: '/pages/login/index' })
}

function editProfile() {
  uni.showActionSheet({
    itemList: ['修改昵称', '更换头像', '修改主题颜色', '返回'],
    success: async (res) => {
      switch (res.tapIndex) {
        case 0:
          changeNickname()
          break
        case 1:
          changeAvatar()
          break
        case 2:
          changeColor()
          break
      }
    }
  })
}

function changeNickname() {
  uni.showModal({
    title: '修改昵称',
    editable: true,
    placeholderText: '请输入新昵称',
    content: currentUser.value?.nickname || '',
    success: async (res) => {
      if (res.confirm && res.content) {
        const nickname = String(res.content).trim()
        if (nickname && nickname.length >= 1 && nickname.length <= 20) {
          try {
            await setUserNickname(nickname)
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

function changeAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: async (res) => {
      const tempFilePath = (res.tempFilePaths && res.tempFilePaths[0]) || ''
      if (tempFilePath) {
        try {
          await setUserAvatar(tempFilePath)
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

function changeColor() {
  const colors = ['#e2e8f0', '#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca', '#f5d0fe', '#c7d2fe']
  const colorNames = ['默认灰', '温暖黄', '自然绿', '天空蓝', '珊瑚红', '梦幻紫', '薰衣草']
  
  uni.showActionSheet({
    itemList: colorNames,
    success: async (res) => {
      const selectedColor = colors[res.tapIndex]
      try {
        await setUserColor(selectedColor)
        userColor.value = selectedColor
        if (currentUser.value) {
          currentUser.value.settings = currentUser.value.settings || {}
          currentUser.value.settings.color = selectedColor
        }
        showHint('主题颜色修改成功', { duration: 1500 })
      } catch (err) {
        showHint('修改失败，请重试', { duration: 2000 })
      }
    }
  })
}

function viewDetailedStats() {
  uni.navigateTo({ url: '/pages/stats/index' })
}

function exportData() {
  if (!userStats.value) {
    showHint('暂无数据可导出', { duration: 2000 })
    return
  }
  
  try {
    const exportData = {
      user: {
        nickname: currentUser.value?.nickname || '微信用户',
        export_time: new Date().toISOString()
      },
      stats: userStats.value
    }
    
    // 复制到剪贴板
    uni.setClipboardData({
      data: JSON.stringify(exportData, null, 2),
      success: () => {
        showHint('数据已复制到剪贴板', { duration: 2000 })
      },
      fail: () => {
        showHint('导出失败，请重试', { duration: 2000 })
      }
    })
  } catch (err) {
    showHint('导出失败', { duration: 2000 })
  }
}

function confirmResetData() {
  uni.showModal({
    title: '确认重置',
    content: '此操作将清除所有游戏记录，且无法恢复。确定要继续吗？',
    confirmText: '确认重置',
    confirmColor: '#ff3b30',
    success: async (res) => {
      if (res.confirm) {
        try {
          await resetUserData()
          userStats.value = { totals: { total: 0, success: 0, fail: 0 }, days: {} }
          showHint('数据重置成功', { duration: 2000 })
        } catch (err) {
          showHint('重置失败，请重试', { duration: 2000 })
        }
      }
    }
  })
}

function logout() {
  uni.showModal({
    title: '确认退出',
    content: '退出登录后，本地游戏数据仍会保留在云端',
    success: (res) => {
      if (res.confirm) {
        clearSession()
        currentUser.value = null
        userStats.value = null
        showHint('已退出登录', { duration: 1500 })
        setTimeout(() => {
          goToLogin()
        }, 1000)
      }
    }
  })
}

function avatarText(name) {
  if (!name) return '用'
  return name.charAt(0).toUpperCase()
}

// 分享功能
onShareAppMessage(() => {
  return {
    title: '24点数学游戏 - 挑战你的数学思维',
    path: '/pages/user/index',
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
  --shadow-lg: 0 8rpx 30rpx rgba(0,0,0,0.08);
  --radius-lg: 16rpx;
  --radius-xl: 20rpx;
  --radius-full: 50%;
  --danger-color: #ff3b30;
}

.page {
  min-height: 100vh;
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
  padding: 32rpx;
}

.current-user-card {
  display: flex;
  align-items: center;
  padding: 40rpx;
  margin-bottom: 40rpx;
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  
  .avatar-img {
    width: 120rpx;
    height: 120rpx;
    border-radius: var(--radius-full);
    margin-right: 30rpx;
  }
  
  .avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48rpx;
    font-weight: bold;
    color: #fff;
    margin-right: 30rpx;
  }
  
  .user-info {
    flex: 1;
    
    .user-name {
      font-size: 36rpx;
      font-weight: bold;
      color: var(--text-primary);
      margin-bottom: 16rpx;
    }
    
    .user-stats {
      display: flex;
      gap: 24rpx;
      
      .stat-item {
        font-size: 28rpx;
        color: var(--text-secondary);
      }
    }
  }
  
  .btn-outline {
    padding: 20rpx 32rpx;
    border: 2rpx solid var(--primary-color);
    border-radius: 32rpx;
    background: transparent;
    color: var(--primary-color);
    font-size: 28rpx;
  }
}

.not-logged-in {
  text-align: center;
  padding: 80rpx 40rpx;
  margin-bottom: 40rpx;
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  
  .login-prompt {
    display: block;
    font-size: 32rpx;
    color: var(--text-secondary);
    margin-bottom: 40rpx;
  }
  
  .btn-primary {
    padding: 24rpx 60rpx;
    background: var(--primary-color);
    color: #fff;
    border-radius: 50rpx;
    font-size: 32rpx;
    font-weight: bold;
  }
}

.operations {
  .operation-group {
    background: var(--bg-primary);
    border-radius: var(--radius-xl);
    margin-bottom: 32rpx;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    
    .group-title {
      display: block;
      padding: 30rpx 40rpx 20rpx;
      font-size: 28rpx;
      font-weight: bold;
      color: var(--text-primary);
      background: #f8f9fa;
    }
    
    .operation-btn {
      width: 100%;
      display: flex;
      align-items: center;
      padding: 30rpx 40rpx;
      border-bottom: 1rpx solid #f0f0f0;
      background: transparent;
      font-size: 32rpx;
      color: var(--text-primary);
      
      &:last-child {
        border-bottom: none;
      }
      
      &.danger {
        color: var(--danger-color);
      }
      
      .btn-icon {
        font-size: 36rpx;
        margin-right: 24rpx;
        width: 48rpx;
        text-align: center;
      }
      
      .btn-text {
        flex: 1;
        text-align: left;
      }
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