<template>
  <view class="page col" style="padding:24rpx; gap:16rpx;"
        @touchstart="edgeHandlers.handleTouchStart"
        @touchmove="edgeHandlers.handleTouchMove"
        @touchend="edgeHandlers.handleTouchEnd"
        @touchcancel="edgeHandlers.handleTouchCancel">
    <UIHeader
      :username="headerTitle"
      @tap-avatar="refresh"
      @tap-settings="showCreateHint"
    />

    <view class="row" style="gap:12rpx; align-items:center;">
      <input v-model="newName" placeholder="新用户名称" class="input" />
      <button class="clay-button-primary" @tap="create">添加</button>
    </view>
    <view class="list">
      <view v-for="u in visibleUsers" :key="u.id" class="item claymorphism card" :class="{ active: u.id===users.currentId }">
        <view class="user-left" @tap="choose(u.id)">
          <image v-if="u.avatar" class="avatar-img" :src="u.avatar" mode="aspectFill" />
          <view v-else class="avatar" :style="{ backgroundColor: u.color || '#e2e8f0' }">{{ avatarText(u.name) }}</view>
          <view class="name">{{ u.name }}</view>
        </view>
        <view class="ops">
          <button class="mini clay-button" @tap="rename(u)">改名</button>
          <button class="mini clay-button" @tap="changeAvatar(u)">头像</button>
          <button class="mini clay-button danger" @tap="remove(u.id)">删除</button>
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
  <BottomTab />

</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import UIHeader from '../../components/UIHeader.vue'
import BottomTab from '../../components/BottomTab.vue'
import { ensureInit, getUsers, addUser, renameUser, removeUser as rmUser, switchUser } from '../../utils/store.js'
import { useFloatingHint } from '../../utils/hints.js'
import { useEdgeExit } from '../../utils/edge-exit.js'
import { saveAvatarForUser, removeAvatarForUser, consumeAvatarRestoreNotice } from '../../utils/avatar.js'
import { exitApp } from '../../utils/navigation.js'

const users = ref({ list: [], currentId: '' })
const newName = ref('')
const headerTitle = computed(() => '用户管理')

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
function showCreateHint(){ showHint('输入名称后点击添加', 1500) }
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
.row { display:flex; align-items:center; }
.input {
  flex:1;
  border:2rpx solid rgba(255,255,255,0.5);
  border-radius:24rpx;
  padding:18rpx 24rpx;
  background: var(--surface-light);
  box-shadow: inset 4rpx 4rpx 8rpx rgba(0,0,0,0.05), inset -4rpx -4rpx 8rpx rgba(255,255,255,0.6);
  font-size:28rpx;
  color:var(--text-dark);
}

.list { display:flex; flex-direction:column; gap:16rpx; }
.item { display:flex; justify-content:space-between; align-items:center; padding:18rpx; border-radius:24rpx; transition:box-shadow .2s ease; }
.item.active { box-shadow: 8rpx 8rpx 16rpx rgba(100,162,197,0.25), -8rpx -8rpx 16rpx rgba(255,255,255,0.8); }
.user-left { display:flex; align-items:center; gap:16rpx; }
.avatar, .avatar-img { width:88rpx; height:88rpx; border-radius:9999rpx; }
.avatar { display:flex; align-items:center; justify-content:center; font-size:34rpx; font-weight:700; color:#fff; background: var(--primary-dark); }
.avatar-img { background: var(--surface-dark); }
.name { font-size:32rpx; font-weight:700; color:var(--text-dark); }

.ops { display:flex; gap:12rpx; }
.mini { padding:12rpx 20rpx; border-radius:20rpx; font-size:26rpx; color:var(--text-dark); }
.mini.danger { color:#c84f4f; }

.floating-hint-layer { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:999; }
.floating-hint-layer.interactive { pointer-events:auto; }
.floating-hint { background:rgba(67,78,90,0.9); color:#fff; padding:24rpx 36rpx; border-radius:24rpx; font-size:28rpx; box-shadow:0 12rpx 24rpx rgba(0,0,0,0.25); }
</style>
