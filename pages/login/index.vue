<template>
  <view
    class="page col"
    style="padding:24rpx; gap:16rpx;"
    @touchstart="edgeHandlers.handleTouchStart"
    @touchmove="edgeHandlers.handleTouchMove"
    @touchend="edgeHandlers.handleTouchEnd"
    @touchcancel="edgeHandlers.handleTouchCancel"
  >
    <UIHeader
      :username="headerTitle"
      @tap-avatar="refresh"
      @tap-settings="createUser"
    />

    <!-- 主体 -->
    <view class="login-body">

      <!-- 错误状态 -->
      <view v-if="errMsg" class="claymorphism card error-card">
        <text class="err-title">数据异常</text>
        <text class="err-text">{{ errMsg }}</text>
        <button class="clay-button" @tap="resetData">重置数据</button>
      </view>

      <!-- 空状态 -->
      <view v-else-if="(sortedUsers.length === 0)" class="claymorphism card empty-card">
        <text class="empty-ill">🃏</text>
        <text class="empty-text">还没有玩家，快创建一个吧！</text>
        <button class="clay-button-primary create-btn" @tap="createUser">
          <text class="create-plus">＋</text>
          <text>新建玩家</text>
        </button>
      </view>

      <!-- 用户列表 -->
      <view v-else class="user-list">
        <button class="user-item claymorphism card" v-for="u in sortedUsers" :key="u.id" @tap="choose(u)">
          <image v-if="u.avatar" class="avatar-img" :src="u.avatar" mode="aspectFill" />
          <view v-else class="avatar" :style="{ backgroundColor: u.color || colorFrom(u) }">{{ avatarText(u.name) }}</view>
          <view class="user-col">
            <view class="user-name">{{ u.name }}</view>
            <view class="user-sub">最近程序：{{ lastPlayedText(u.lastPlayedAt) }}</view>
              <!-- </text>
            </text> -->
          </view>
          <text class="chev">›</text>
        </button>
        <button class="clay-button create-btn" @tap="createUser">
          <text class="create-plus">＋</text>
          <text>新建玩家</text>
        </button>
      </view>
    </view>

    <!-- 底部区块：原“以游客登录”入口已移除 -->
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
import UIHeader from '../../components/UIHeader.vue'
import { ensureInit, getUsers, addUser, switchUser, resetAllData, touchLastPlayed } from '../../utils/store.js'
import { saveAvatarForUser } from '../../utils/avatar.js'
import { useFloatingHint } from '../../utils/hints.js'
import { useEdgeExit } from '../../utils/edge-exit.js'
import { exitApp } from '../../utils/navigation.js'

const users = ref({ list: [], currentId: '' })
const errMsg = ref('')
const headerTitle = computed(() => '选择玩家')

const { hintState, showHint, hideHint } = useFloatingHint()
const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitLoginPage() })

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
  // 登录流程进入首页：使用 reLaunch 清空栈，避免出现系统返回按钮
  try { uni.reLaunch({ url }) }
  catch(_) { try { uni.switchTab({ url }) } catch(_) {} }
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
        const size = (sel.tempFiles && sel.tempFiles[0] && sel.tempFiles[0].size) || 0
        finalizeCreate(name, path, size)
      }, fail(){ finalizeCreate(name, '') } })
    } else if (idx === 2) {
      finalizeCreate(name, '') // 我们用随机背景色
    } else if (idx === 3) {
      finalizeCreate(name, '')
    }
    // idx === 0 就是点了“标题”，这里通常不处理
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
.login-body { display:flex; flex-direction:column; gap:16rpx; }

.error-card { display:flex; flex-direction:column; gap:12rpx; text-align:center; }
.err-title { font-size:32rpx; font-weight:800; color:var(--text-dark); }
.err-text { font-size:26rpx; color:var(--text-light); }

.empty-card { display:flex; flex-direction:column; align-items:center; gap:16rpx; text-align:center; padding:32rpx 16rpx; }
.empty-ill { font-size:80rpx; }
.empty-text { font-size:28rpx; color:var(--text-light); }
.create-btn { display:flex; align-items:center; justify-content:center; gap:12rpx; font-size:28rpx; font-weight:700; padding:16rpx 24rpx; }
.create-plus { font-size:36rpx; }

.user-list { display:flex; flex-direction:column; gap:16rpx; }
.user-item { display:flex; align-items:center; gap:16rpx; padding:16rpx; border-radius:24rpx; }
.user-item:active { box-shadow: inset 4rpx 4rpx 8rpx var(--bg-dark), inset -4rpx -4rpx 8rpx #ffffff; }
.avatar-img, .avatar { width:96rpx; height:96rpx; border-radius:9999rpx; }
.avatar { display:flex; align-items:center; justify-content:center; font-size:36rpx; font-weight:700; color:#fff; background:var(--primary-dark); }
.user-col { flex:1; display:flex; flex-direction:column; gap:6rpx; }
.user-name { font-size:32rpx; font-weight:700; color:var(--text-dark); }
.user-sub { font-size:24rpx; color:var(--text-light); }
.chev { font-size:40rpx; color:var(--text-light); }

.floating-hint-layer { position:fixed; left:0; right:0; top:0; bottom:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:999; }
.floating-hint-layer.interactive { pointer-events:auto; }
.floating-hint { background:rgba(67,78,90,0.9); color:#fff; padding:24rpx 36rpx; border-radius:24rpx; font-size:28rpx; box-shadow:0 12rpx 24rpx rgba(0,0,0,0.25); }
</style>
