# Frontend Implementation Guide

This document provides the key code snippets and structural pseudo-code for implementing the user account system in the uni-app frontend.

## 1. Global State & API Management

It's recommended to use a global state management solution (like Vuex or Pinia) to store user information and tokens.

### `store/user.js` (Example using Vuex-like syntax)

```javascript
// A simple reactive object for state management
import { reactive } from 'vue';

const userStore = reactive({
  token: uni.getStorageSync('token') || '',
  userInfo: uni.getStorageSync('userInfo') || null,
  localAccounts: uni.getStorageSync('local_accounts') || [],

  isLoggedIn() {
    return !!this.token && !!this.userInfo;
  },

  isLocalAccount() {
    return this.userInfo?.account_type === 'local';
  },

  // Set user info and token after login
  login(data) {
    this.token = data.token;
    this.userInfo = data.user;
    uni.setStorageSync('token', data.token);
    uni.setStorageSync('userInfo', data.user);
  },

  // Clear user info on logout
  logout() {
    this.token = '';
    this.userInfo = null;
    uni.removeStorageSync('token');
    uni.removeStorageSync('userInfo');
  },

  // --- Local Accounts Management ---

  getLocalAccounts() {
    this.localAccounts = uni.getStorageSync('local_accounts') || [];
    return this.localAccounts;
  },

  addLocalAccount(account) {
    const accounts = this.getLocalAccounts();
    accounts.push(account);
    this.localAccounts = accounts;
    uni.setStorageSync('local_accounts', accounts);
  },

  removeLocalAccount(userId) {
    let accounts = this.getLocalAccounts();
    accounts = accounts.filter(acc => acc._id !== userId);
    this.localAccounts = accounts;
    uni.setStorageSync('local_accounts', accounts);
  }
});

export default userStore;
```

### `api/user.js` (API wrapper for cloud function)

```javascript
function callLogin(data) {
  return new Promise((resolve, reject) => {
    uniCloud.callFunction({
      name: 'login',
      data,
      success: (res) => {
        if (res.result.errCode === 0) {
          resolve(res.result);
        } else {
          uni.showToast({ title: res.result.errMsg, icon: 'none' });
          reject(res.result);
        }
      },
      fail: (err) => {
        uni.showToast({ title: '服务繁忙，请稍后再试', icon: 'none' });
        reject(err);
      }
    });
  });
}

export const loginWithWeixin = () => {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: async (loginRes) => {
        try {
          const result = await callLogin({
            scene: 'mp-weixin',
            code: loginRes.code,
            platform: 'mp-weixin'
          });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      },
      fail: reject
    });
  });
};

export const createLocalAccount = (nickname, avatar_url) => {
  return callLogin({
    scene: 'create-local',
    deviceId: getDeviceId(),
    platform: getPlatform(),
    extra: { nickname, avatar_url }
  });
};

export const loginWithLocalAccount = (user_id) => {
  return callLogin({
    scene: 'app',
    user_id,
    deviceId: getDeviceId()
  });
};

export const upgradeToWeixinAccount = (user_id) => {
   return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: async (loginRes) => {
        try {
          const result = await callLogin({
            scene: 'upgrade',
            code: loginRes.code,
            user_id: user_id
          });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      },
      fail: reject
    });
  });
};

export const deleteLocalAccount = (user_id) => {
  return callLogin({
    scene: 'delete-local',
    user_id,
    deviceId: getDeviceId()
  });
};

// --- Helper Functions ---

function getPlatform() {
  const platform = uni.getSystemInfoSync().platform;
  if (platform === 'android') return 'app-android';
  if (platform === 'ios') return 'app-ios';
  // NOTE: HarmonyOS detection might need specific logic
  return 'app-harmony';
}

function getDeviceId() {
  // #ifdef APP-PLUS
  return plus.device.uuid;
  // #endif

  // #ifdef MP-WEIXIN
  let deviceId = uni.getStorageSync('device_id');
  if (!deviceId) {
    // A simple way to generate a UUID-like string on the client
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
    uni.setStorageSync('device_id', deviceId);
  }
  return deviceId;
  // #endif

  return ''; // Fallback
}
```

## 2. Page Implementations

### `pages/login-selector/login-selector.vue`

```vue
<template>
  <view>
    <!-- #ifdef MP-WEIXIN -->
    <button @click="onWeixinLogin">微信一键登录</button>
    <!-- #endif -->
    <button @click="goToLocalAccounts">普通账号登录</button>
  </view>
</template>

<script setup>
import { loginWithWeixin } from '@/api/user.js';
import userStore from '@/store/user.js';

async function onWeixinLogin() {
  uni.showLoading({ title: '登录中...' });
  try {
    const { token, user } = await loginWithWeixin();
    userStore.login({ token, user });
    uni.hideLoading();
    // Redirect to home page
    uni.switchTab({ url: '/pages/home/home' });
  } catch (err) {
    uni.hideLoading();
    console.error(err);
  }
}

function goToLocalAccounts() {
  uni.navigateTo({ url: '/pages/local-accounts/local-accounts' });
}
</script>
```

### `pages/local-accounts/local-accounts.vue`

```vue
<template>
  <view>
    <view v-for="account in userStore.localAccounts" :key="account._id">
      <view @click="onLogin(account._id)" @longpress="onShowMenu(account)">
        <image :src="account.avatar_url" />
        <text>{{ account.nickname }}</text>
      </view>
    </view>
    <button @click="goToCreateAccount">新建普通账号</button>
  </view>
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app';
import { loginWithLocalAccount, deleteLocalAccount } from '@/api/user.js';
import userStore from '@/store/user.js';

onShow(() => {
  userStore.getLocalAccounts();
});

async function onLogin(userId) {
  uni.showLoading({ title: '登录中...' });
  try {
    const { token, user } = await loginWithLocalAccount(userId);
    userStore.login({ token, user });
    uni.hideLoading();
    uni.switchTab({ url: '/pages/home/home' });
  } catch (err) {
    uni.hideLoading();
  }
}

function onShowMenu(account) {
  uni.showActionSheet({
    itemList: ['删除账号'],
    success: async (res) => {
      if (res.tapIndex === 0) {
        await deleteLocalAccount(account._id);
        userStore.removeLocalAccount(account._id);
        uni.showToast({ title: '删除成功' });
      }
    }
  });
}

function goToCreateAccount() {
  uni.navigateTo({ url: '/pages/create-account/create-account' });
}
</script>
```

### `pages/create-account/create-account.vue`

```vue
<template>
  <view>
    <input v-model="nickname" placeholder="请输入昵称" />
    <!-- Avatar selection logic here -->
    <button @click="onCreate">创建</button>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { createLocalAccount } from '@/api/user.js';
import userStore from '@/store/user.js';

const nickname = ref('');
const avatar_url = ref('default_avatar.png'); // Default or selected avatar

async function onCreate() {
  if (!nickname.value) {
    uni.showToast({ title: '昵称不能为空', icon: 'none' });
    return;
  }

  uni.showLoading({ title: '创建中...' });
  try {
    const { token, user } = await createLocalAccount(nickname.value, avatar_url.value);
    // Add to local storage and log in
    userStore.addLocalAccount(user);
    userStore.login({ token, user });
    uni.hideLoading();
    uni.switchTab({ url: '/pages/home/home' });
  } catch(err) {
    uni.hideLoading();
  }
}
</script>
```

### `pages/profile/profile.vue`

```vue
<template>
  <view>
    <text>用户: {{ userStore.userInfo?.nickname }}</text>
    <!-- #ifdef MP-WEIXIN -->
    <button v-if="userStore.isLocalAccount()" @click="onUpgrade">
      升级为微信账号
    </button>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { upgradeToWeixinAccount } from '@/api/user.js';
import userStore from '@/store/user.js';

async function onUpgrade() {
  uni.showLoading({ title: '升级中...' });
  try {
    const { token, user } = await upgradeToWeixinAccount(userStore.userInfo._id);
    // After upgrade, the old local account is merged. We should update local storage.
    userStore.removeLocalAccount(userStore.userInfo._id);
    userStore.login({ token, user });
    uni.hideLoading();
    uni.showToast({ title: '升级成功！' });
  } catch(err) {
    uni.hideLoading();
  }
}
</script>
```
