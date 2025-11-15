// utils/auth.js

const TOKEN_KEY = 'uni_id_token';
const USER_INFO_KEY = 'uni_user_info';

/**
 * 统一登录入口
 * @returns {Promise<object>}
 */
export async function login() {
  let res;
  // #ifdef MP-WEIXIN
  res = await wxLogin();
  // #endif

  // #ifdef APP-PLUS
  res = await appLogin();
  // #endif

  if (res && res.errCode === 0) {
    const {
      token,
      userInfo
    } = res.data;
    // 保存 token 和用户信息到本地存储
    uni.setStorageSync(TOKEN_KEY, token);
    uni.setStorageSync(USER_INFO_KEY, userInfo);
    console.log('登录成功:', res.data);
    return res.data;
  } else {
    uni.showToast({
      title: res.errMsg || '登录失败',
      icon: 'none'
    });
    console.error('登录失败:', res);
    throw new Error(res.errMsg);
  }
}

/**
 * 微信小程序登录
 */
async function wxLogin() {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: async (loginRes) => {
        try {
          console.log('wxLogin: uni.login success, calling cloud function...');
          const result = await uniCloud.callFunction({
            name: 'login',
            data: {
              scene: 'mp-weixin',
              code: loginRes.code
            }
          });
          resolve(result.result);
        } catch (e) {
          console.error('wxLogin: callFunction error', e);
          reject(e);
        }
      },
      fail: (err) => {
        console.error('wxLogin: uni.login failed:', err);
        reject(err);
      }
    });
  });
}

/**
 * App 端游客登录
 */
async function appLogin() {
  return new Promise((resolve, reject) => {
    // App 端使用设备 ID 作为唯一标识
    // plus.device.uuid 在某些情况下可能不唯一或变化，可结合其他信息增强唯一性
    const deviceId = plus.device.uuid;
    console.log('appLogin: deviceId =', deviceId);
    uniCloud.callFunction({
      name: 'login',
      data: {
        scene: 'app',
        deviceId: deviceId
      }
    }).then(res => {
      resolve(res.result);
    }).catch(err => {
      console.error('appLogin: callFunction error', err);
      reject(err);
    });
  });
}


/**
 * 获取微信用户的昵称和头像，并上传到云端
 * @returns {Promise<object>}
 */
export async function getWxProfileAndUpdate() {
  return new Promise((resolve, reject) => {
    uni.getUserProfile({
      desc: '用于完善会员资料',
      success: async (infoRes) => {
        const {
          nickName,
          avatarUrl
        } = infoRes.userInfo;

        try {
          console.log('getWxProfileAndUpdate: getUserProfile success, calling cloud object...');
          // 调用云对象更新用户信息
          const user = uniCloud.importObject('user');
          const updateResult = await user.updateProfile({
            nickname: nickName,
            avatar_url: avatarUrl
          });

          if (updateResult.errCode === 0) {
            // 更新本地存储的用户信息
            uni.setStorageSync(USER_INFO_KEY, updateResult.data.userInfo);
            console.log('用户信息更新成功:', updateResult.data.userInfo);
            resolve(updateResult.data.userInfo);
          } else {
            console.error('用户信息更新失败:', updateResult.errMsg);
            reject(new Error(updateResult.errMsg));
          }
        } catch (e) {
          console.error('调用 user.updateProfile 云对象失败', e);
          reject(e);
        }
      },
      fail: (err) => {
        uni.showToast({
          title: '您已取消授权',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

/**
 * 获取本地缓存的 Token
 * @returns {string|null}
 */
export function getToken() {
  return uni.getStorageSync(TOKEN_KEY);
}

/**
 * 获取本地缓存的用户信息
 * @returns {object|null}
 */
export function getUserInfo() {
  return uni.getStorageSync(USER_INFO_KEY);
}

/**
 * 检查是否已登录
 * @returns {boolean}
 */
export function isLogged() {
  return !!getToken();
}

/**
 * 退出登录
 */
export function logout() {
  uni.removeStorageSync(TOKEN_KEY);
  uni.removeStorageSync(USER_INFO_KEY);
  // 可以在这里通过 event bus 通知所有页面更新状态
  uni.$emit('user-logout');
  console.log('用户已退出登录');
}
