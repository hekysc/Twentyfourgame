<template>
  <view class="profile-page"
    ><AppNavBar title="我的资料" :show-back="true" />
    <view class="body"
      ><text class="heading">{{ online ? '微信在线帐号' : '本地练习' }}</text>
      <text class="copy">{{
        online
          ? '资料和游戏数据保存在云端。'
          : '无需帐号，练习记录只保存在这台设备。'
      }}</text>
      <view v-if="online" class="card">
        <button
          class="avatar"
          open-type="chooseAvatar"
          @chooseavatar="chooseAvatar"
        >
          <image v-if="avatar" :src="avatar" mode="aspectFill" /><text v-else
            >头像</text
          >
        </button>
        <text class="copy">点击选用微信头像，或从相册上传</text
        ><button class="small" @tap="album">从相册选择</button>
        <text class="label">用户名</text
        ><input
          type="nickname"
          v-model="name"
          maxlength="20"
          placeholder="使用微信昵称或自行填写"
          @blur="name = $event.detail.value"
        />
        <text class="copy"
          >榜单只对本人显示全名；其他人看到首字符和 *，不显示头像。</text
        >
        <button class="primary" :loading="busy" :disabled="busy" @tap="save">
          保存资料
        </button>
      </view>
      <button @tap="ranking">查看排行榜</button
      ><button @tap="changeMode">
        {{ online ? '切换到本地练习' : '微信登录，参与排名' }}
      </button>
      <text v-if="message" class="message">{{ message }}</text>
    </view></view
  >
</template>
<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppNavBar from '../../components/AppNavBar.vue'
import { isOnline, currentIdentity } from '../../utils/identity.js'
import { saveProfile, enterPractice, flushPrefs } from '../../utils/online.js'
const online = ref(isOnline()),
  name = ref(''),
  avatar = ref(''),
  busy = ref(false),
  message = ref('')
onShow(() => {
  online.value = isOnline()
  const u = currentIdentity()
  name.value = u.name
  avatar.value = u.avatar
})
function chooseAvatar(e) {
  avatar.value = e.detail.avatarUrl
}
function album() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album'],
    success: (r) => {
      avatar.value = r.tempFilePaths[0]
    },
  })
}
async function save() {
  busy.value = true
  message.value = ''
  try {
    const u = await saveProfile(name.value, avatar.value)
    avatar.value = u.avatar
    message.value = '已保存到云端'
  } catch (e) {
    message.value = e.message
  } finally {
    busy.value = false
  }
}
function ranking() {
  uni.navigateTo({ url: '/pages/ranking/index' })
}
async function changeMode() {
  if (isOnline()) {
    try {
      await flushPrefs()
    } catch (_) {
      return
    }
    enterPractice()
    uni.reLaunch({ url: '/pages/index/index' })
  } else uni.reLaunch({ url: '/pages/login/index' })
}
</script>
<style scoped>
.profile-page {
  min-height: 100vh;
  background: #f7f3e8;
  color: #253c34;
}
.body {
  padding: 40rpx;
}
.heading {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
}
.copy {
  display: block;
  font-size: 25rpx;
  color: #738077;
  line-height: 1.8;
  margin: 18rpx 0;
}
.card {
  padding: 32rpx;
  border-radius: 26rpx;
  background: #fffdf6;
  border: 1rpx solid #d9ded2;
}
.avatar {
  padding: 0;
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar image {
  width: 100%;
  height: 100%;
}
.label {
  display: block;
  margin-top: 32rpx;
}
input {
  background: #f1f0e7;
  border-radius: 14rpx;
  padding: 22rpx;
  margin: 16rpx 0;
}
button {
  margin-top: 24rpx;
  border-radius: 18rpx;
  color: #275c48;
  background: #e8ecdf;
  font-size: 28rpx;
}
.primary {
  background: #275c48;
  color: white;
}
.small {
  font-size: 24rpx;
}
.message {
  display: block;
  margin-top: 20rpx;
  color: #947747;
}
</style>
