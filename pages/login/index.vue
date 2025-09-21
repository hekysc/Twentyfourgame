<template>
  <view
    class="login-page"
    @touchstart="edgeHandlers.handleTouchStart"
    @touchmove="edgeHandlers.handleTouchMove"
    @touchend="edgeHandlers.handleTouchEnd"
    @touchcancel="edgeHandlers.handleTouchCancel"
  >
    <view class="login-topbar">
      <text class="login-title">无敌24点程序·观测</text>
    </view>

    <view class="login-body">
      <view class="login-heading">
        <text class="h1">选择玩家</text>
        <text class="heading-desc">独立记录每位玩家的闯关成绩</text>
      </view>

      <view v-if="errMsg" class="error-card card section">
        <text class="err-title">数据异常</text>
        <text class="err-text">{{ errMsg }}</text>
        <button class="btn danger" @tap="resetData">重置数据</button>
      </view>

      <view v-else-if="(sortedUsers.length === 0)" class="empty-card card section">
        <view class="empty-card-inner">
          <text class="empty-badge">欢迎加入</text>
          <text class="empty-ill">🃏</text>
          <text class="empty-text">还没有玩家，快创建一个吧！</text>
          <text class="empty-desc">我们会为每位玩家准备专属统计面板</text>
          <button class="create-btn highlight" @tap="createUser">
            <text class="create-plus">＋</text>
            <text>新建玩家</text>
          </button>
        </view>
      </view>

      <view v-else class="user-list">
        <view class="list-guide">
          <text class="guide-badge">提示</text>
          <text class="guide-text">点选卡片即可进入程序，当前角色的对局将被优先记录。</text>
        </view>
        <button
          class="user-item card section"
          v-for="(u, idx) in sortedUsers"
          :key="u.id"
          @tap="choose(u)"
          :style="userCardStyle(u, idx)"
        >
          <view class="user-item-inner">
            <view class="avatar-wrapper">
              <view class="avatar-ring" :style="avatarRingStyle(u)">
                <image
                  v-if="u.avatar"
                  class="avatar-img"
                  :src="u.avatar"
                  mode="aspectFill"
                />
                <view v-else class="avatar-generated">
                  <image class="avatar-pattern" :src="defaultAvatarFor(u).uri" mode="aspectFill" />
                  <text class="avatar-initial" :style="{ color: defaultAvatarFor(u).palette.text }">
                    {{ avatarText(u.name) }}
                  </text>
                </view>
              </view>
              <text
                v-if="users.currentId === u.id"
                class="avatar-badge"
                :style="badgeStyle(u, 'active')"
              >当前</text>
              <text
                v-else-if="idx === 0"
                class="avatar-badge"
                :style="badgeStyle(u, 'recent')"
              >常用</text>
            </view>
            <view class="user-col">
              <view class="user-name-row">
                <text class="user-name">{{ u.name }}</text>
              </view>
              <view class="user-sub-row">
                <text class="user-meta-label">最近游玩</text>
                <text class="user-meta-value">{{ lastPlayedText(u.lastPlayedAt) }}</text>
              </view>
              <text class="user-hint" :style="{ color: defaultAvatarFor(u).palette.overlay }">点击卡片即可快速进入</text>
            </view>
            <view class="chev-box">
              <text class="chev">›</text>
            </view>
          </view>
        </button>
        <button class="create-btn ghost" @tap="createUser">
          <text class="create-plus">＋</text>
          <text>新建玩家</text>
        </button>
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
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ensureInit, getUsers, addUser, switchUser, resetAllData, touchLastPlayed } from '../../utils/store.js'
import { saveAvatarForUser, generateDefaultAvatar } from '../../utils/avatar.js'
import { useFloatingHint } from '../../utils/hints.js'
import { useEdgeExit } from '../../utils/edge-exit.js'
import { exitApp } from '../../utils/navigation.js'

const users = ref({ list: [], currentId: '' })
const errMsg = ref('')

const { hintState, showHint, hideHint } = useFloatingHint()
const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitLoginPage() })

const defaultAvatarCache = new Map()
const FALLBACK_AVATAR = generateDefaultAvatar('tf24-default', { size: 128 })

onMounted(() => {
  ensureInit();
  safeLoad();
  try { updateVHVar() } catch(_) {}
  if (uni.onWindowResize) uni.onWindowResize(() => { try { updateVHVar() } catch(_) {} })
})

function defaultAvatarFor(user) {
  if (!user) return FALLBACK_AVATAR
  const key = `${user.id || ''}|${user.name || ''}|${user.color || ''}`
  if (!defaultAvatarCache.has(key)) {
    defaultAvatarCache.set(key, generateDefaultAvatar(key, { size: 128 }))
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
    style.boxShadow = `0 30rpx 60rpx ${theme.softShadow}`
  }
  return style
}

function avatarRingStyle(user) {
  const theme = defaultAvatarFor(user)
  return {
    borderColor: theme.borderColor,
    boxShadow: `0 12rpx 24rpx ${theme.softShadow}`,
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

function updateVHVar(){
  try {
    const sys = (uni.getSystemInfoSync && uni.getSystemInfoSync()) || {}
    const h = sys.windowHeight || (typeof window !== 'undefined' ? window.innerHeight : 0) || 0
    if (h && typeof document !== 'undefined' && document.documentElement && document.documentElement.style) {
      document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px')
    }
  } catch (_) { /* noop */ }
}

function safeLoad(){
  try {
    const u = getUsers()
    if (!u || !Array.isArray(u.list) || u.currentId === undefined) {
      throw new Error('本地用户数据结构无效')
    }
    users.value = u
  } catch (e) {
    errMsg.value = (e && e.message) ? e.message : '本地存储损坏'
  }
}

const sortedUsers = computed(() => {
  const list = (users.value.list || []).filter(u => String(u.name||'') !== 'Guest').slice()
  list.sort((a,b) => (b.lastPlayedAt||0) - (a.lastPlayedAt||0) || (b.createdAt||0) - (a.createdAt||0))
  return list
})

function refresh() { safeLoad() }
function go(url){
  try { uni.reLaunch({ url }) }
  catch(_) { try { uni.switchTab({ url }) } catch(_) {} }
}
function choose(u) { switchUser(u.id); touchLastPlayed(u.id); go('/pages/index/index') }
function createUser() {
  uni.showModal({ title:'新建玩家', editable:true, placeholderText:'昵称（1-20字）', success(res){
    if (!res.confirm) return
    const name = String(res.content||'').trim()
    if (!name || name.length < 1 || name.length > 20) { uni.showToast({ title:'请输入1-20字昵称', icon:'none' }); return }
    const exists = (users.value.list||[]).some(x => String(x.name||'').toLowerCase() === name.toLowerCase())
    if (exists) {
      uni.showModal({ title:'提示', content:'已有同名玩家，是否继续创建？', success(r2){ if (r2.confirm) stepChooseAvatar(name);
 else createUser() } })
    } else {
      stepChooseAvatar(name)
    }
  }})
}
function stepChooseAvatar(name){
  uni.showActionSheet({ itemList:['请选择头像方式','从相册选择','随机分配','跳过'], success(a){
    const idx = a.tapIndex
    if (idx === 1) {
      uni.chooseImage({ count:1, sizeType:['compressed'], success(sel){
        const path = (sel.tempFilePaths && sel.tempFilePaths[0]) || ''
        const size = (sel.tempFiles && sel.tempFiles[0] && sel.tempFiles[0].size) || 0
        finalizeCreate(name, path, size)
      }, fail(){ finalizeCreate(name, '') } })
    } else if (idx === 2) {
      finalizeCreate(name, '')
    } else if (idx === 3) {
      finalizeCreate(name, '')
    }
  }, fail(){ finalizeCreate(name, '') } })
}
function finalizeCreate(name, avatar, size){
  const id = addUser(name, '')
  if (avatar) {
    saveAvatarForUser(id, avatar, { size }).then(res => {
      if (!res || !res.ok) {
        try { uni.showToast({ title:'头像保存失败，请重试', icon:'none' }) } catch (_) {}
      }
    })
  }
  switchUser(id)
  touchLastPlayed(id)
  go('/pages/login/index')
}
function exitLoginPage(){
  exitApp({
    fallback: () => {
      try { uni.navigateBack({ delta:1 }) }
      catch (_) {
        try { uni.reLaunch({ url:'/pages/index/index' }) }
        catch (__) {}
      }
    },
  })
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
function resetData(){
  uni.showModal({ title:'重置数据', content:'将清空本地所有数据，是否继续？', success(res){ if(res.confirm){ resetAllData(); errMsg.value=''; refresh() } } })
}
</script>

<style scoped>
.login-page {
  min-height: 100dvh;
  min-height: calc(var(--vh, 1vh) * 100);
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 55%, #f1f5f9 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
body {
  overflow: hidden;
  height: 100vh;
}
.login-topbar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 32rpx;
}
.login-title {
  font-weight: 900;
  font-size: 36rpx;
  color: #0e141b;
  letter-spacing: -0.5rpx;
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
.login-body {
  flex: 1;
  padding: 0 32rpx 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  overflow: hidden;
  position: relative;
}
.login-body::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top right, rgba(148,163,184,0.18), transparent 55%);
  pointer-events: none;
}
.login-heading {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
}
.h1 {
  font-size: 56rpx;
  font-weight: 900;
  color: #0e141b;
}
.heading-desc {
  font-size: 26rpx;
  color: #475569;
}
.user-list {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 0 20rpx 24rpx 20rpx;
  overflow-y: auto;
  min-height: 0;
}
.user-list::-webkit-scrollbar {
  width: 6rpx;
}
.user-list::-webkit-scrollbar-track {
  background: transparent;
}
.user-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3rpx;
}
.user-list::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
.list-guide {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: rgba(148,163,184,0.14);
  border: 2rpx dashed rgba(148,163,184,0.35);
  border-radius: 18rpx;
  padding: 16rpx 20rpx;
  color: #475569;
  font-size: 24rpx;
}
.guide-badge {
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  color: #fff;
  font-weight: 700;
  border-radius: 999rpx;
  padding: 4rpx 18rpx;
  font-size: 22rpx;
}
.user-item {
  position: relative;
  border-radius: 28rpx;
  border: 2rpx solid transparent;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  padding: 18rpx 26rpx;
  overflow: hidden;
}
.user-item::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 2rpx solid rgba(255,255,255,0.3);
  pointer-events: none;
}
.user-item:active {
  transform: scale(0.97);
}
.user-item-inner {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.avatar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}
.avatar-ring {
  width: 96rpx;
  height: 96rpx;
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
  width: 80rpx;
  height: 80rpx;
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
  font-size: 32rpx;
  z-index: 1;
}
.avatar-badge {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 700;
  color: #fff;
  backdrop-filter: blur(6rpx);
}
.user-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}
.user-name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.user-name {
  font-size: 36rpx;
  color: #0f172a;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-sub-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  color: #475569;
}
.user-meta-label {
  font-weight: 600;
  opacity: 0.72;
}
.user-meta-value {
  font-weight: 600;
}
.user-hint {
  font-size: 22rpx;
  color: #64748b;
}
.chev-box {
  width: 56rpx;
  height: 56rpx;
  border-radius: 18rpx;
  background: rgba(255,255,255,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.chev {
  color: rgba(15,23,42,0.55);
  font-size: 44rpx;
  font-weight: 800;
}
.create-btn {
  height: 104rpx;
  border-radius: 28rpx;
  background: rgba(226,232,240,0.8);
  color: #0f172a;
  font-size: 32rpx;
  font-weight: 800;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  transition: transform 0.18s ease;
}
.create-btn:active {
  transform: scale(0.97);
}
.create-btn.highlight {
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  color: #fff;
  box-shadow: 0 18rpx 40rpx rgba(20, 184, 166, 0.25);
}
.create-btn.ghost {
  background: rgba(148,163,184,0.18);
  color: #0f172a;
}
.create-plus {
  font-size: 36rpx;
}
.empty-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx 32rpx;
  border-radius: 32rpx;
  border: 2rpx solid rgba(148,163,184,0.35);
  overflow: hidden;
}
.empty-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, rgba(56,189,248,0.16), rgba(59,130,246,0.08));
}
.empty-card-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  text-align: center;
  z-index: 1;
}
.empty-badge {
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  color: #fff;
  font-weight: 700;
  font-size: 22rpx;
}
.empty-ill {
  font-size: 96rpx;
}
.empty-text {
  color: #0f172a;
  font-size: 32rpx;
  font-weight: 700;
}
.empty-desc {
  color: #475569;
  font-size: 24rpx;
}
.error-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 36rpx 24rpx;
  border-radius: 28rpx;
  border: 2rpx solid rgba(248,113,113,0.35);
  background: linear-gradient(135deg, rgba(254,226,226,0.55), rgba(252,165,165,0.35));
}
.err-title {
  font-weight: 800;
  color: #b91c1c;
  font-size: 32rpx;
}
.err-text {
  color: #6b7280;
  text-align: center;
  font-size: 26rpx;
}
.btn.danger {
  background: #ef4444;
  color: #fff;
  border: none;
  padding: 20rpx 28rpx;
  border-radius: 14rpx;
}
button {
  -webkit-tap-highlight-color: rgba(0,0,0,0);
}

@media screen and (min-width: 900px) {
  .login-body {
    flex-direction: row;
    align-items: flex-start;
    gap: 40rpx;
    padding: 20rpx 80rpx 60rpx 80rpx;
  }
  .login-heading {
    width: 320rpx;
    align-items: flex-start;
    text-align: left;
    margin-top: 60rpx;
  }
  .user-list {
    max-width: 760rpx;
    padding: 0 40rpx 40rpx 40rpx;
  }
}

@media screen and (max-width: 640px) {
  .login-body {
    padding: 0 16rpx 24rpx 16rpx;
  }
  .user-item-inner {
    gap: 20rpx;
  }
  .user-item {
    padding: 16rpx 20rpx;
  }
  .avatar-ring {
    width: 88rpx;
    height: 88rpx;
    padding: 6rpx;
  }
  .avatar-img,
  .avatar-generated {
    width: 72rpx;
    height: 72rpx;
  }
}

@media screen and (max-width: 480px) {
  .user-item-inner {
    align-items: flex-start;
  }
  .chev-box {
    margin-left: auto;
  }
}
</style>
