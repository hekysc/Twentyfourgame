<template>
  <view class="page" style="padding:24rpx; display:flex; flex-direction:column; gap:16rpx;">
    <view class="row" style="gap:12rpx; align-items:center;">
      <input v-model="newName" placeholder="新用户名称" class="input" />
      <button class="btn btn-primary" @tap="create">添加</button>
    </view>
    <view class="list">
      <view v-for="u in visibleUsers" :key="u.id" class="item card section" :class="{ active: u.id===users.currentId }">
        <view class="name" @tap="choose(u.id)">{{ u.name }}</view>
        <view class="ops">
          <button class="mini" @tap="rename(u)">改名</button>
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
import { ensureInit, getUsers, setUsers, addUser, renameUser, removeUser as rmUser, switchUser } from '../../utils/store.js'

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
</script>

<style scoped>
.input{ flex:1; border:2rpx solid #e5e7eb; border-radius:12rpx; padding:16rpx; background:#fff }
.list{ display:flex; flex-direction:column; gap:12rpx }
.item{ display:flex; justify-content:space-between; align-items:center; padding:16rpx; border-radius:16rpx; border:2rpx solid #e5e7eb; background:#fff; box-shadow:0 6rpx 16rpx rgba(15,23,42,0.06) }
.item.active{ border-color:#1677ff55; box-shadow:0 6rpx 16rpx rgba(22, 119, 255, 0.12) }
.name{ font-size:32rpx; font-weight:700 }
.ops{ display:flex; gap:8rpx }
.mini{ padding:8rpx 12rpx; border-radius:10rpx; background:#eef2f7; font-size:24rpx }
.mini.danger{ background:#fee2e2; color:#b91c1c }
.btn-primary{ background:#1677ff; color:#fff; border:none; padding:18rpx 24rpx; border-radius:12rpx }
</style>

