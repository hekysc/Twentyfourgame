<template>
  <view class="page" style="padding:24rpx; display:flex; flex-direction:column; gap:16rpx;"
        @touchstart="swipeStart" @touchmove="swipeMove" @touchend="swipeEnd">
    <view class="row" style="gap:12rpx; align-items:center;">
      <input v-model="newName" placeholder="新用户名称" class="input" />
      <button class="btn btn-primary" @tap="create">添加</button>
    </view>
    <view class="list">
      <view v-for="u in visibleUsers" :key="u.id" class="item card section" :class="{ active: u.id===users.currentId }">
        <view class="user-left" @tap="choose(u.id)">
          <image v-if="u.avatar" class="avatar-img" :src="u.avatar" mode="aspectFill" />
          <view v-else class="avatar" :style="{ backgroundColor: u.color || '#e2e8f0' }">{{ avatarText(u.name) }}</view>
          <view class="name">{{ u.name }}</view>
        </view>
        <view class="ops">
          <button class="mini" @tap="rename(u)">改名</button>
          <button class="mini" @tap="changeAvatar(u)">头像</button>
          <button class="mini danger" @tap="remove(u.id)">删除</button>
        </view>
      </view>
    </view>
  </view>
  <CustomTabBar />
  
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import CustomTabBar from '../../components/CustomTabBar.vue'
import { ensureInit, getUsers, setUsers, addUser, renameUser, removeUser as rmUser, switchUser, setUserAvatar } from '../../utils/store.js'

const users = ref({ list: [], currentId: '' })
const newName = ref('')

// 过滤掉游客账号（名称为 Guest 的历史记录）
const visibleUsers = computed(() => (users.value.list || []).filter(u => String(u.name||'') !== 'Guest'))

onMounted(() => { try { uni.hideTabBar && uni.hideTabBar() } catch (_) {}; ensureInit(); users.value = getUsers() })

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
  uni.showModal({ title:'删除用户', content:'确定删除该用户？', success(res){ if(res.confirm){ rmUser(id); refresh() } } })
}
function changeAvatar(u){
  try {
    uni.showActionSheet({ itemList:['从相册选择','移除头像','取消'], success(a){
      const i = a.tapIndex
      if (i === 0) {
        uni.chooseImage({ count:1, sizeType:['compressed'], success(sel){
          const path = (sel.tempFilePaths && sel.tempFilePaths[0]) || ''
          setUserAvatar(u.id, path)
          refresh()
        }})
      } else if (i === 1) {
        setUserAvatar(u.id, '')
        refresh()
      }
    } })
  } catch (_) { /* noop */ }
}
function avatarText(name){
  if (!name) return 'U'
  const s = String(name).trim()
  return s.length ? s[0].toUpperCase() : 'U'
}

// —— 左右滑动切换 Tab ——
const swipeTracking = ref(false)
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const swipeDX = ref(0)
const swipeDY = ref(0)

function swipeStart(e){
  try {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    swipeTracking.value = true
    swipeStartX.value = t.clientX || t.pageX || 0
    swipeStartY.value = t.clientY || t.pageY || 0
    swipeDX.value = 0
    swipeDY.value = 0
  } catch(_) {}
}
function swipeMove(e){
  if (!swipeTracking.value) return
  try {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    const x = t.clientX || t.pageX || 0
    const y = t.clientY || t.pageY || 0
    swipeDX.value = x - swipeStartX.value
    swipeDY.value = y - swipeStartY.value
  } catch(_) {}
}
function swipeEnd(){
  if (!swipeTracking.value) return
  swipeTracking.value = false
  const dx = swipeDX.value
  const dy = swipeDY.value
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX > 60 && absX > absY * 1.5) {
    if (dx > 0) {
      navigateTab('/pages/index/index')
    }
  }
}
function navigateTab(url){
  const done = () => {}
  if (uni && typeof uni.switchTab === 'function') {
    uni.switchTab({ url, success: done, fail(){
      if (typeof uni.navigateTo === 'function') {
        uni.navigateTo({ url, success: done, fail(){
          if (typeof uni.reLaunch === 'function') {
            uni.reLaunch({ url, success: done, fail: done })
          } else { done() }
        } })
      } else if (typeof uni.reLaunch === 'function') {
        uni.reLaunch({ url, success: done, fail: done })
      } else { done() }
    } })
  } else if (typeof uni.navigateTo === 'function') {
    uni.navigateTo({ url, success: done, fail(){
      if (typeof uni.reLaunch === 'function') {
        uni.reLaunch({ url, success: done, fail: done })
      } else { done() }
    } })
  } else if (typeof uni.reLaunch === 'function') {
    uni.reLaunch({ url, success: done, fail: done })
  }
}
</script>

<style scoped>
.input{ flex:1; border:2rpx solid #e5e7eb; border-radius:12rpx; padding:16rpx; background:#fff }
.list{ display:flex; flex-direction:column; gap:12rpx }
.item{ display:flex; justify-content:space-between; align-items:center; padding:16rpx; border-radius:16rpx; border:2rpx solid #e5e7eb; background:#fff; box-shadow:0 6rpx 16rpx rgba(15,23,42,0.06) }
.item.active{ border-color:#1677ff55; box-shadow:0 6rpx 16rpx rgba(22, 119, 255, 0.12) }
.user-left{ display:flex; align-items:center; gap:12rpx }
.avatar{ width:72rpx; height:72rpx; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-weight:800; color:#0f172a; }
.avatar-img{ width:72rpx; height:72rpx; border-radius:50%; background:#e2e8f0 }
.name{ font-size:32rpx; font-weight:700 }
.ops{ display:flex; gap:8rpx }
.mini{ padding:8rpx 12rpx; border-radius:10rpx; background:#eef2f7; font-size:24rpx }
.mini.danger{ background:#fee2e2; color:#b91c1c }
.btn-primary{ background:#1677ff; color:#fff; border:none; padding:18rpx 24rpx; border-radius:12rpx }
</style>

