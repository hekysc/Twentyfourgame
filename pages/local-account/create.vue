<template>
  <view class="create-page">
    <AppNavBar title="创建普通账号" :show-back="true" />
    <view class="form">
      <view class="field">
        <text class="label">昵称</text>
        <input v-model="nickname" class="input" placeholder="请输入昵称" maxlength="16" />
      </view>
      <view class="field">
        <text class="label">头像（可选）</text>
        <view class="avatar-picker" @tap="chooseAvatar">
          <image v-if="avatar" :src="avatar" mode="aspectFill" />
          <text v-else>从相册选择</text>
        </view>
      </view>
      <button class="primary" :loading="submitting" @tap="submit">创建并登录</button>
      <view v-if="errMsg" class="error">{{ errMsg }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import AppNavBar from '../../components/AppNavBar.vue'
import { createLocalAccount } from '../../utils/auth.js'
import { guessPlatformScene } from '../../utils/platform.js'

const nickname = ref('')
const avatar = ref('')
const submitting = ref(false)
const errMsg = ref('')

function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success(res) {
      const path = (res.tempFilePaths && res.tempFilePaths[0]) || ''
      avatar.value = path
    },
  })
}

async function submit() {
  if (submitting.value) return
  const name = nickname.value.trim()
  if (!name) {
    errMsg.value = '请填写昵称'
    return
  }
  submitting.value = true
  errMsg.value = ''
  try {
    const uploadAvatar = avatar.value ? await uploadAvatarTemp(avatar.value) : ''
    await createLocalAccount({ nickname: name, avatar_url: uploadAvatar, platform: guessPlatformScene() })
    uni.showToast({ title: '创建成功', icon: 'success' })
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (err) {
    errMsg.value = err?.message || '创建失败'
  } finally {
    submitting.value = false
  }
}

async function uploadAvatarTemp(path) {
  try {
    const res = await uniCloud.uploadFile({ filePath: path, cloudPath: `avatars/${Date.now()}-${Math.random()}.png` })
    return res.fileID || ''
  } catch (err) {
    console.warn('上传头像失败，转为本地路径', err)
    return path
  }
}
</script>

<style scoped>
.create-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}
.form {
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.label {
  font-size: 28rpx;
  color: #475569;
}
.input {
  height: 88rpx;
  border-radius: 16rpx;
  border: 1px solid #cbd5f5;
  padding: 0 24rpx;
  background: #fff;
}
.avatar-picker {
  height: 200rpx;
  border: 1px dashed #94a3b8;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}
.avatar-picker image {
  width: 100%;
  height: 100%;
  border-radius: 24rpx;
}
.primary {
  height: 96rpx;
  border-radius: 20rpx;
  background: linear-gradient(90deg, #4f46e5, #0ea5e9);
  color: #fff;
  border: none;
  font-size: 32rpx;
}
.error {
  color: #dc2626;
  font-size: 26rpx;
}
</style>
