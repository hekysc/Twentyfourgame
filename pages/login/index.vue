<template>
  <view class="login-page">
    <!-- 顶部栏 -->
    <view class="login-topbar">
      <!-- <button class="icon-btn" @tap="goBack">←</button> -->
      <text class="login-title">无敌24点游戏·观测</text>
      <!-- <view style="width:40rpx"></view> -->
    </view>

    <!-- 主体 -->
    <view class="login-body">
      <view class="login-heading">
        <text class="h1">选择玩家</text>
      </view>

      <!-- 错误状态 -->
      <view v-if="errMsg" class="error-card card section">
        <text class="err-title">数据异常</text>
        <text class="err-text">{{ errMsg }}</text>
        <button class="btn danger" @tap="resetData">重置数据</button>
      </view>

      <!-- 空状态 -->
      <view v-else-if="(sortedUsers.length === 0)" class="empty-card card section">
        <text class="empty-ill">🃏</text>
        <text class="empty-text">还没有玩家，快创建一个吧！</text>
        <button class="create-btn highlight" @tap="createUser">
          <text class="create-plus">＋</text>
          <text>新建玩家</text>
        </button>
      </view>

      <!-- 用户列表 -->
      <view v-else class="user-list">
        <button class="user-item card section" v-for="u in sortedUsers" :key="u.id" @tap="choose(u)">
          <image v-if="u.avatar" class="avatar-img" :src="u.avatar" mode="aspectFill" />
          <view v-else class="avatar" :style="{ backgroundColor: u.color || colorFrom(u) }">{{ avatarText(u.name) }}</view>
          <view class="user-col">
            <view class="user-name">{{ u.name }}</view>
            <view class="user-sub">最近游戏：{{ lastPlayedText(u.lastPlayedAt) }}</view>
              <!-- </text>
            </text> -->
          </view>
          <text class="chev">›</text>
        </button>
        <button class="create-btn" @tap="createUser">
          <text class="create-plus">＋</text>
          <text>新建玩家</text>
        </button>
      </view>
    </view>

    <!-- 底部区块：原“以游客登录”入口已移除 -->
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ensureInit, getUsers, addUser, switchUser, resetAllData, touchLastPlayed } from '../../utils/store.js'

const users = ref({ list: [], currentId: '' })
const errMsg = ref('')

onMounted(() => {
  ensureInit();
  safeLoad();
  try { updateVHVar() } catch(_) {}
  if (uni.onWindowResize) uni.onWindowResize(() => { try { updateVHVar() } catch(_) {} })
})

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
    // 简单校验结构
    if (!u || !Array.isArray(u.list) || u.currentId === undefined) {
      throw new Error('本地用户数据结构无效')
    }
    users.value = u
  } catch (e) {
    errMsg.value = (e && e.message) ? e.message : '本地存储损坏'
  }
}

const sortedUsers = computed(() => {
  // 过滤掉历史上可能遗留的“Guest/游客”记录，不在列表中展示
  const list = (users.value.list || []).filter(u => String(u.name||'') !== 'Guest').slice()
  list.sort((a,b) => (b.lastPlayedAt||0) - (a.lastPlayedAt||0) || (b.createdAt||0) - (a.createdAt||0))
  return list
})

function refresh() { safeLoad() }
function go(url){
  try { uni.reLaunch({ url }) }
  catch(e1){ try { uni.navigateTo({ url }) } catch(_) { try { uni.switchTab({ url }) } catch(_) {} } }
}
// function goBack() { try { uni.navigateBack() } catch(e) { go('/pages/index/index') } }
function choose(u) { switchUser(u.id); touchLastPlayed(u.id); go('/pages/index/index') }
function createUser() {
  uni.showModal({ title:'新建玩家', editable:true, placeholderText:'昵称（1-20字）', success(res){
    if (!res.confirm) return
    const name = String(res.content||'').trim()
    if (!name || name.length < 1 || name.length > 20) { uni.showToast({ title:'请输入1-20字昵称', icon:'none' }); return }
    const exists = (users.value.list||[]).some(x => String(x.name||'').toLowerCase() === name.toLowerCase())
    if (exists) {
      uni.showModal({ title:'提示', content:'已有同名玩家，是否继续创建？', success(r2){ if (r2.confirm) stepChooseAvatar(name); else createUser() } })
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
        finalizeCreate(name, path)
      }, fail(){ finalizeCreate(name, '') } })
    } else if (idx === 2) {
      finalizeCreate(name, '') // 我们用随机背景色
    } else if (idx === 3) {
      finalizeCreate(name, '')
    }
    // idx === 0 就是点了“标题”，这里通常不处理
  }, fail(){ finalizeCreate(name, '') } })
}
function finalizeCreate(name, avatar){
  const id = addUser(name, avatar)
  switchUser(id)
  touchLastPlayed(id)
  go('/pages/login/index')
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
function colorFrom(u){
  const base = String(u.id || u.name || '')
  let hash = 0; for (let i=0;i<base.length;i++){ hash = (hash*33 + base.charCodeAt(i))>>>0 }
  const palette = ['#e2e8f0','#fde68a','#bbf7d0','#bfdbfe','#fecaca','#f5d0fe','#c7d2fe']
  return palette[hash % palette.length]
}
function resetData(){
  uni.showModal({ title:'重置数据', content:'将清空本地所有数据，是否继续？', success(res){ if(res.confirm){ resetAllData(); errMsg.value=''; refresh() } } })
}
</script>

<style scoped>
 .login-page {
  /* 视口高度填满，兼容移动端动态地址栏 */
  min-height: 100dvh;
  min-height: calc(var(--vh, 1vh) * 100);
  background: #f1f5f9;
  display: flex;
  flex-direction: column;
  overflow: hidden;  /* 防止整体滚动 */
}
body {
  overflow: hidden;
  height: 100vh;
}
.login-topbar{ display:flex; align-items:center; padding:24rpx; gap:12rpx }
/* .icon-btn{ width:64rpx; height:64rpx; border-radius:50%; background:#e5e7eb; display:flex; align-items:center; justify-content:center; border:none; } */
.login-title{ flex:1; text-align:center; font-weight:900; font-size:36rpx; color:#0e141b; letter-spacing:-0.5rpx }
.login-body {
  flex: 1;  /* 占据剩余空间 */
  padding: 10rpx 2.5rpx 0 2.5rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;  /* 防止溢出 */
  min-height: 0;  /* 允许收缩 */
  height: 0;  /* 强制高度约束 */
}
.login-heading { 
  flex-shrink: 0;  /* 不收缩 */
  text-align: center; 
  margin: 0rpx 0 24rpx 0;
  height: 80rpx;  /* 固定高度 */
  display: flex;
  align-items: center;
  justify-content: center;
}
.h1{ font-size:56rpx; font-weight:900; color:#0e141b }
.user-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 0 100rpx 20rpx 100rpx;  /* 改为padding，不用margin */
  overflow-y: auto;
  min-height: 0;
  height: 0;  /* 强制高度约束 */
}
/* 滚动条样式优化 */
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
.user-item{ display:flex; align-items:center; padding:10rpx; height:100rpx;width:100%; border-radius:12rpx; border:2rpx solid #cfd8e3; background:#ffffff; box-shadow:0 2rpx 4rpx rgba(15,23,42,0.02) }
.user-item:active{ transform:scale(0.98) }
.avatar{ width:72rpx; height:72rpx; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-weight:800; color:#0f172a; margin-right:20rpx }
.avatar-img{ width:72rpx; height:72rpx; border-radius:50%; margin-right:20rpx; background:#e2e8f0 }
.user-col{
  flex:1;
  display:grid;
  /* 方案A：定宽（最稳妥，确保“最近游戏”纵向齐） */
  grid-template-columns: minmax(0, 200rpx) 1fr;  /* ← 原来是 auto 1fr */
  /* 也可用半定宽：grid-template-columns: minmax(240rpx, 36vw) 1fr; 
     （注意小程序端对 clamp/minmax 的兼容性，H5/App 正常） */
  align-items:left;
  justify-items:start;                /* ✅ 内容在各列内靠左 */
  column-gap:10rpx; 
  min-width:0;
}
.user-name {
  font-size:34rpx;
  color:#0f172a;
  font-weight:700;
  white-space:nowrap;               /* ✅ 不换行 */
  overflow:hidden;
  text-overflow:ellipsis;           /* ✅ 超长省略号 */
  text-align:left;                    /* ✅ 明确指定左对齐 */
  width: 100%;      /* 关键修复 */
  max-width: 100%;  /* 双重保险 */
}
.user-sub {
  font-size:20rpx;
  color:#64748b;
  white-space:nowrap;
  align-self:center;                     /* ✅ 单独确保这一列底对齐 */
}
.chev{
  flex:0 0 auto;          /* 不要挤压中间列 */
  width: 40rpx;           /* 可选：固定宽度，视觉更稳 */
  text-align:right;
  color:#94a3b8; font-size:40rpx; font-weight:800; margin-left:12rpx;
}
.create-btn{ margin-top:20rpx; height:100rpx; border-radius:24rpx; background:#e2e8f0; color:#0f172a; font-size:32rpx; font-weight:800; border:none; display:flex; align-items:center; justify-content:center; gap:12rpx }
.create-btn.highlight{ background:#145751; color:#fff }
.create-plus{ font-size:36rpx }
/* 底部区块相关样式已移除（guest 入口下线） */
button{ -webkit-tap-highlight-color:rgba(0,0,0,0) }

/* 空/错 视图 */
.empty-card, .error-card {
  flex: 1;  /* 占据可用空间 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;  /* 垂直居中 */
  gap: 16rpx;
  padding: 40rpx 24rpx;
  margin: 50rpx 100rpx;
  border-radius: 24rpx;
  background: #fff;
  border: 2rpx solid #e5e7eb;
  max-height: 100%;  /* 不超出容器 */
  overflow-y: auto;  /* 如果内容过多也能滚动 */
}
.empty-ill{ font-size:88rpx }
.empty-text{ color:#6b7280 }
.err-title{ font-weight:800; color:#b91c1c }
.err-text{ color:#6b7280; text-align:center }
.btn.danger{ background:#ef4444; color:#fff; border:none; padding:20rpx 28rpx; border-radius:14rpx }
</style>
