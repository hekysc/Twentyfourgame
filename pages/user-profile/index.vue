<template>
  <view class="profile-container">
    <!-- 用户信息区域 -->
    <view class="user-info-card">
      <image class="avatar" :src="userInfo.avatar_url || '/static/logo.png'" mode="aspectFill"></image>
      <text class="nickname">{{ userInfo.nickname || '未登录' }}</text>
      <text class="user-id" v-if="userInfo._id">ID: {{ userInfo._id }}</text>
    </view>

    <!-- 功能按钮区域 -->
    <view class="action-list">
      <!-- #ifdef MP-WEIXIN -->
      <button class="action-button primary" @click="handleUpdateProfile">
        <text class="button-text">更新微信头像昵称</text>
      </button>
      <!-- #endif -->

      <!-- #ifdef APP-PLUS -->
       <button class="action-button" @click="showToast('App端请在设置页修改')">
        <text class="button-text">修改个人资料</text>
      </button>
      <!-- #endif -->

      <button class="action-button info" @click="refreshProfile">
        <text class="button-text">刷新资料</text>
      </button>

       <button class="action-button danger" @click="handleLogout">
        <text class="button-text">退出登录</text>
      </button>
    </view>

  </view>
</template>

<script>
import {
  getWxProfileAndUpdate,
  logout,
  getToken
} from '@/utils/auth.js';

export default {
  data() {
    return {
      userInfo: {}
    };
  },
  onShow() {
    this.syncUserInfo();
    uni.$on('user-info-updated', this.syncUserInfo);
  },
  onUnload() {
    uni.$off('user-info-updated', this.syncUserInfo);
  },
  methods: {
    syncUserInfo() {
        const app = getApp();
        if (app.globalData.isLogged) {
            this.userInfo = app.globalData.userInfo;
        } else {
            this.userInfo = {};
        }
    },
    async handleUpdateProfile() {
      // #ifdef MP-WEIXIN
      try {
        uni.showLoading({ title: '更新中...' });
        const updatedUserInfo = await getWxProfileAndUpdate();
        this.userInfo = updatedUserInfo;
        getApp().globalData.userInfo = updatedUserInfo;
        uni.showToast({ title: '更新成功', icon: 'success' });
      } catch (e) {
        console.error('更新失败:', e);
      } finally {
        uni.hideLoading();
      }
      // #endif
    },
    async refreshProfile() {
        uni.showLoading({ title: '正在刷新...' });
        try {
            const res = await uniCloud.callFunction({
                name: 'user',
                data: {
                    action: 'getProfile',
                    token: getToken()
                }
            });
            const result = res.result;
            if (result.errCode === 0) {
                const newUserInfo = result.data.userInfo;
                this.userInfo = newUserInfo;
                getApp().globalData.userInfo = newUserInfo;
                uni.setStorageSync('uni_user_info', newUserInfo);
                uni.showToast({ title: '刷新成功', icon: 'success' });
            } else {
                uni.showToast({ title: result.errMsg, icon: 'none' });
            }
        } catch (e) {
            uni.showToast({ title: '刷新失败，请重试', icon: 'none' });
        } finally {
            uni.hideLoading();
        }
    },
    handleLogout() {
        logout();
        this.userInfo = {};
        getApp().globalData.isLogged = false;
        getApp().globalData.userInfo = null;
        uni.showToast({ title: '已退出登录', icon: 'none' });
    },
    showToast(message) {
        uni.showToast({ title: message, icon: 'none' });
    }
  }
};
</script>

<style scoped>
.profile-container {
  display: flex; flex-direction: column; align-items: center; padding: 40rpx; background-color: #f7f7f7; min-height: 100vh;
}
.user-info-card {
  display: flex; flex-direction: column; align-items: center; background-color: #ffffff; border-radius: 20rpx; padding: 40rpx; width: 100%; box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05); margin-bottom: 40rpx;
}
.avatar {
  width: 160rpx; height: 160rpx; border-radius: 50%; border: 4rpx solid #eee; margin-bottom: 20rpx;
}
.nickname {
  font-size: 36rpx; font-weight: bold; color: #333; margin-bottom: 10rpx;
}
.user-id {
    font-size: 24rpx; color: #999;
}
.action-list {
  width: 100%; display: flex; flex-direction: column; gap: 30rpx;
}
.action-button {
  background-color: #fff; border-radius: 10rpx; box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.05); display: flex; justify-content: center; align-items: center; height: 90rpx; padding: 0; margin: 0; line-height: normal;
}
.action-button::after {
    border: none;
}
.button-text {
  font-size: 30rpx; color: #333;
}
.action-button.primary {
  background-color: #007aff;
}
.action-button.primary .button-text {
  color: #fff;
}
.action-button.info {
  background-color: #5ac8fa;
}
.action-button.info .button-text {
  color: #fff;
}
.action-button.danger {
    background-color: #ff3b30;
}
.action-button.danger .button-text {
    color: #fff;
}
</style>
