<template>
  <view class="page"
        @touchstart="edgeHandlers.handleTouchStart"
        @touchmove="edgeHandlers.handleTouchMove"
        @touchend="edgeHandlers.handleTouchEnd"
        @touchcancel="edgeHandlers.handleTouchCancel">
    <view class="management-hero card section">
      <view class="hero-top">
        <text class="hero-title">管理角色</text>
        <text class="hero-sub">维护玩家昵称与头像，切换当前操作者。</text>
      </view>
      <view class="hero-note">
        <text class="hero-tag">说明</text>
        <text class="hero-desc">列表按最近游玩排序，当前角色会自动高亮。</text>
      </view>
    </view>

    <view class="create-panel card section">
      <view class="create-header">
        <text class="create-title">快速添加</text>
        <text class="create-hint">输入昵称后点击“添加”即可创建新角色，稍后可在列表中完善头像。</text>
      </view>
      <view class="create-row">
        <input v-model="newName" placeholder="新用户名称" class="input" />
        <button class="btn btn-primary" @tap="create">添加</button>
      </view>
    </view>

    <view class="list-card card section">
      <view class="list-header">
        <text class="list-title">角色列表</text>
        <text class="list-sub">轻触左侧卡片可立即切换，右侧按钮用于编辑资料。</text>
      </view>
      <view class="list">
        <view v-for="(u, idx) in visibleUsers" :key="u.id" class="item card section"
              :class="{ active: u.id===users.currentId }"
              :style="userCardStyle(u, idx)">
          <view class="item-left" @tap="choose(u.id)">
            <view class="avatar-wrapper">
              <view class="avatar-ring" :style="avatarRingStyle(u)">
                <image v-if="u.avatar" class="avatar-img" :src="u.avatar" mode="aspectFill" />
                <view v-else class="avatar-generated">
                  <image class="avatar-pattern" :src="defaultAvatarFor(u).uri" mode="aspectFill" />
                  <text class="avatar-initial" :style="{ color: defaultAvatarFor(u).palette.text }">{{ avatarText(u.name) }}</text>
                </view>
              </view>
              <text v-if="u.id===users.currentId" class="avatar-badge" :style="badgeStyle(u, 'active')">当前玩家</text>
              <text v-else-if="idx === 0" class="avatar-badge" :style="badgeStyle(u, 'recent')">近期活跃</text>
            </view>
            <view class="text-block">
              <view class="name-row">
                <text class="name">{{ u.name }}</text>
              </view>
              <view class="meta-row">
                <text class="meta-label">最近游玩</text>
                <text class="meta-value">{{ lastPlayedText(u.lastPlayedAt) }}</text>
              </view>
              <text class="switch-hint" :style="{ color: defaultAvatarFor(u).palette.overlay }">点击左侧卡片即可切换至该角色</text>
            </view>
          </view>
          <view class="ops">
            <text class="ops-title">操作</text>
            <view class="ops-buttons">
              <button class="mini accent" :style="accentButtonStyle(u, 'primary')" @tap.stop="rename(u)">改名</button>
              <button class="mini accent" :style="accentButtonStyle(u, 'secondary')" @tap.stop="changeAvatar(u)">头像</button>
              <button class="mini danger" @tap.stop="remove(u.id)">删除</button>
            </view>
            <text class="ops-desc">删除后将移除该角色的历史统计</text>
          </view>
        </view>
      </view>
    </view>

    <view
      v-if="hintState.visible"
      class="floating-hint-layer"
      :class="{ interactive: hintState.interactive }"
      @tap="hideHint"
    >
      <view class="floating-hint" @tap.stop>{{ hintState.text }}</view>
    </view>
  </view>
  <CustomTabBar />
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import CustomTabBar from '../../components/CustomTabBar.vue'
import { ensureInit, getUsers, addUser, renameUser, removeUser as rmUser, switchUser } from '../../utils/store.js'
import { useFloatingHint } from '../../utils/hints.js'
import { useEdgeExit } from '../../utils/edge-exit.js'
import { saveAvatarForUser, removeAvatarForUser, consumeAvatarRestoreNotice, generateDefaultAvatar } from '../../utils/avatar.js'
import { exitApp } from '../../utils/navigation.js'

const users = ref({ list: [], currentId: '' })
const newName = ref('')

const { hintState, showHint, hideHint } = useFloatingHint()
const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitPage() })

const defaultAvatarCache = new Map()
const FALLBACK_AVATAR = generateDefaultAvatar('tf24-default-user', { size: 120 })

const visibleUsers = computed(() => (users.value.list || []).filter(u => String(u.name||'') !== 'Guest'))

onMounted(() => { try { uni.hideTabBar && uni.hideTabBar() } catch (_) {}; ensureInit(); users.value = getUsers() })

onShow(() => {
  try { uni.$emit && uni.$emit('tabbar:update') } catch (_) {}
  if (consumeAvatarRestoreNotice()) {
    showHint('头像文件丢失，已为你恢复为默认头像', 2000)
  }
})

function defaultAvatarFor(user) {
  if (!user) return FALLBACK_AVATAR
  const key = `${user.id || ''}|${user.name || ''}|${user.color || ''}`
  if (!defaultAvatarCache.has(key)) {
    defaultAvatarCache.set(key, generateDefaultAvatar(key, { size: 120 }))
  }
  return defaultAvatarCache.get(key) || FALLBACK_AVATAR
}

function userCardStyle(user, index = 0) {
  const theme = defaultAvatarFor(user)
  const style = {
    background: theme.panelGradient,
    borderColor: theme.borderColor,
    boxShadow: theme.shadow
  }
  if (users.value && users.value.currentId === user.id) {
    style.borderColor = theme.palette.accent
  }
  if (index === 0) {
    style.boxShadow = `0 32rpx 64rpx ${theme.softShadow}`
  }
  return style
}

function avatarRingStyle(user) {
  const theme = defaultAvatarFor(user)
  return {
    borderColor: theme.borderColor,
    boxShadow: `0 10rpx 22rpx ${theme.softShadow}`,
    background: '#ffffff'
  }
}

function badgeStyle(user, mode = 'active') {
  const theme = defaultAvatarFor(user)
  const gradient = mode === 'recent' ? theme.altBadgeGradient : theme.badgeGradient
  return {
    background: gradient,
    color: theme.palette.badgeText,
    boxShadow: `0 12rpx 24rpx ${theme.badgeShadow}`
  }
}

function accentButtonStyle(user, mode = 'primary') {
  const theme = defaultAvatarFor(user)
  const gradient = mode === 'secondary' ? theme.altBadgeGradient : theme.badgeGradient
  return {
    background: gradient,
    color: theme.palette.badgeText,
    boxShadow: `0 12rpx 28rpx ${theme.badgeShadow}`
  }
}

function refresh(){ users.value = getUsers() }
function create(){ addUser(newName.value.trim()||undefined); newName.value=''; refresh() }
function choose(id){
  switchUser(id)
  refresh()
  try { uni.reLaunch({ url:'/pages/index/index' }) }
  catch(_){ try { uni.navigateTo({ url:'/pages/index/index' }) } catch(e) {} }
}
function rename(u){
  uni.showModal({ title:'改名', editable:true, placeholderText:u.name, success(res){ if(res.confirm){ renameUser(u.id, res.content||u.name); refresh() } } })
}
function remove(id){
  uni.showModal({
    title:'删除用户',
    content:'确定删除该用户？',
    success(res){
      if(res.confirm){
        removeAvatarForUser(id).finally(() => {
          rmUser(id)
          refresh()
        })
      }
    }
  })
}
function changeAvatar(u){
  if (!u || !u.id) return
  try {
    uni.showActionSheet({
      itemList: ['从相册选择', '移除头像', '取消'],
      success(a) {
        const i = a.tapIndex
        if (i === 0) {
          try {
            uni.chooseImage({
              count: 1,
              sizeType: ['compressed'],
              success(sel) {
                const path = (sel.tempFilePaths && sel.tempFilePaths[0]) || ''
                const size = (sel.tempFiles && sel.tempFiles[0] && sel.tempFiles[0].size) || 0
                if (!path) { showHint('未选择有效头像', 1500); return }
                saveAvatarForUser(u.id, path, { size }).then(res => {
                  if (!res || !res.ok) {
                    showHint('头像保存失败，请重试', 1800)
                  } else {
                    showHint('头像已更新', 1200)
                  }
                  refresh()
                })
              },
              fail() {
                showHint('头像选择已取消', 1200)
              }
            })
          } catch (_) {}
        } else if (i === 1) {
          removeAvatarForUser(u.id)
            .then(() => {
              showHint('已恢复默认头像', 1500)
              refresh()
            })
            .catch(() => { showHint('头像清除失败，请重试', 1800) })
        }
      }
    })
  } catch (_) { /* noop */ }
}
function avatarText(name){
  if (!name) return 'U'
  const s = String(name).trim()
  return s.length ? s[0].toUpperCase() : 'U'
}

function lastPlayedText(ts){
  if (!ts) return '从未游玩'
  try {
    const d = new Date(ts)
    const now = Date.now()
    const dd = new Date()
    const isToday = d.toDateString() === dd.toDateString()
    const y = d.getFullYear(), m = (d.getMonth()+1).toString().padStart(2,'0'), day = d.getDate().toString().padStart(2,'0')
    const hh = d.getHours().toString().padStart(2,'0'), mm = d.getMinutes().toString().padStart(2,'0')
    if (isToday) return `今天 ${hh}:${mm}`
    const yesterday = new Date(now - 86400000)
    if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hh}:${mm}`
    return `${y}-${m}-${day} ${hh}:${mm}`
  } catch(_) { return '时间未知' }
}

function exitPage(){
  exitApp({
    fallback: () => {
      try {
        if (typeof uni.switchTab === 'function') {
          uni.switchTab({ url: '/pages/index/index' })
          return
        }
      } catch (_) {}
      try {
        if (typeof uni.reLaunch === 'function') {
          uni.reLaunch({ url: '/pages/index/index' })
          return
        }
      } catch (_) {}
    }
  })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32rpx 32rpx 120rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 45%, #f1f5f9 100%);
  position: relative;
}
.management-hero {
  background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(14,165,233,0.08));
  border: 2rpx solid rgba(148,163,184,0.35);
  border-radius: 28rpx;
  padding: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.hero-title {
  font-size: 40rpx;
  font-weight: 900;
  color: #0f172a;
}
.hero-sub {
  font-size: 26rpx;
  color: #475569;
}
.hero-note {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  color: #475569;
}
.hero-tag {
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  color: #fff;
  font-weight: 700;
  border-radius: 999rpx;
  padding: 4rpx 18rpx;
  font-size: 22rpx;
}
.create-panel {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  border-radius: 28rpx;
  border: 2rpx solid rgba(148,163,184,0.25);
  background: rgba(255,255,255,0.85);
  padding: 28rpx;
}
.create-header {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.create-title {
  font-size: 32rpx;
  font-weight: 800;
  color: #0f172a;
}
.create-hint {
  font-size: 24rpx;
  color: #64748b;
}
.create-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}
.input {
  flex: 1;
  border: 2rpx solid #e5e7eb;
  border-radius: 16rpx;
  padding: 18rpx 20rpx;
  background: #fff;
  font-size: 28rpx;
}
.btn-primary {
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: #fff;
  border: none;
  padding: 18rpx 32rpx;
  border-radius: 16rpx;
  font-weight: 700;
}
.list-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  border-radius: 32rpx;
  border: 2rpx solid rgba(148,163,184,0.3);
  background: rgba(255,255,255,0.9);
  padding: 28rpx;
  min-height: 0;
}
.list-header {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.list-title {
  font-size: 34rpx;
  font-weight: 800;
  color: #0f172a;
}
.list-sub {
  font-size: 24rpx;
  color: #475569;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  overflow-y: auto;
  padding-right: 6rpx;
}
.list::-webkit-scrollbar {
  width: 6rpx;
}
.list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3rpx;
}
.item {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  border-radius: 28rpx;
  border: 2rpx solid transparent;
  padding: 22rpx;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.item.active {
  border-color: rgba(37,99,235,0.55);
}
.item:active {
  transform: scale(0.98);
}
.item-left {
  display: flex;
  gap: 20rpx;
  align-items: center;
}
.avatar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}
.avatar-ring {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255,255,255,0.6);
  padding: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.avatar-img,
.avatar-generated {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
}
.avatar-generated {
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-pattern {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.avatar-initial {
  font-weight: 800;
  font-size: 30rpx;
  z-index: 1;
}
.avatar-badge {
  font-size: 22rpx;
  padding: 4rpx 18rpx;
  border-radius: 999rpx;
  font-weight: 700;
  color: #fff;
}
.text-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.name {
  font-size: 34rpx;
  font-weight: 800;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  color: #475569;
}
.meta-label {
  font-weight: 600;
  opacity: 0.7;
}
.meta-value {
  font-weight: 600;
}
.switch-hint {
  font-size: 22rpx;
  color: #64748b;
}
.ops {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  background: rgba(255,255,255,0.6);
  border-radius: 24rpx;
  border: 2rpx solid rgba(148,163,184,0.25);
  padding: 16rpx;
}
.ops-title {
  font-size: 24rpx;
  font-weight: 700;
  color: #0f172a;
}
.ops-buttons {
  display: flex;
  gap: 12rpx;
}
.mini {
  padding: 10rpx 22rpx;
  border-radius: 14rpx;
  font-size: 24rpx;
  border: none;
}
.mini.accent {
  color: #fff;
}
.mini.danger {
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #fff;
  box-shadow: 0 12rpx 24rpx rgba(239,68,68,0.3);
}
.ops-desc {
  font-size: 22rpx;
  color: #64748b;
}
.floating-hint-layer {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 999;
}
.floating-hint-layer.interactive {
  pointer-events: auto;
}
.floating-hint {
  max-width: 70%;
  background: rgba(15,23,42,0.86);
  color: #fff;
  padding: 24rpx 36rpx;
  border-radius: 24rpx;
  text-align: center;
  font-size: 30rpx;
  box-shadow: 0 20rpx 48rpx rgba(15,23,42,0.25);
  backdrop-filter: blur(12px);
}

@media screen and (min-width: 900px) {
  .page {
    padding: 40rpx 80rpx 140rpx 80rpx;
  }
  .item {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .ops {
    width: 320rpx;
    align-self: stretch;
    justify-content: center;
  }
  .ops-buttons {
    flex-wrap: wrap;
  }
}

@media screen and (max-width: 640px) {
  .create-row {
    flex-direction: column;
    align-items: stretch;
  }
  .btn-primary {
    width: 100%;
  }
  .item-left {
    align-items: flex-start;
  }
  .ops {
    align-self: stretch;
  }
  .ops-buttons {
    flex-wrap: wrap;
  }
}
</style>
