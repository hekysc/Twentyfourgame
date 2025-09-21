<template>
  <view class="page" style="padding:24rpx; display:flex; flex-direction:column; gap:16rpx;"
        @touchstart="edgeHandlers.handleTouchStart"
        @touchmove="edgeHandlers.handleTouchMove"
        @touchend="edgeHandlers.handleTouchEnd"
        @touchcancel="edgeHandlers.handleTouchCancel">
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
import { saveAvatarForUser, removeAvatarForUser, consumeAvatarRestoreNotice } from '../../utils/avatar.js'
import { exitApp } from '../../utils/navigation.js'

const users = ref({ list: [], currentId: '' })
const newName = ref('')

const { hintState, showHint, hideHint } = useFloatingHint()
const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitPage() })

// 过滤掉游客账号（名称为 Guest 的历史记录）
const visibleUsers = computed(() => (users.value.list || []).filter(u => String(u.name||'') !== 'Guest'))

onMounted(() => { try { uni.hideTabBar && uni.hideTabBar() } catch (_) {}; ensureInit(); users.value = getUsers() })

onShow(() => {
  try { uni.$emit && uni.$emit('tabbar:update') } catch (_) {}
  if (consumeAvatarRestoreNotice()) {
    showHint('头像文件丢失，已为你恢复为默认头像', 2000)
  }
})

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
.page{ min-height:100vh; box-sizing:border-box; position:relative; }
.floating-hint-layer{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:999 }
.floating-hint-layer.interactive{ pointer-events:auto }
.floating-hint{ max-width:70%; background:rgba(15,23,42,0.86); color:#fff; padding:24rpx 36rpx; border-radius:24rpx; text-align:center; font-size:30rpx; box-shadow:0 20rpx 48rpx rgba(15,23,42,0.25); backdrop-filter:blur(12px) }
</style>

