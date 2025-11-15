<<<<<<< HEAD
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
          const result = await uniCloud.callFunction({
            name: 'login',
            data: {
              scene: 'mp-weixin',
              code: loginRes.code
            }
          });
          resolve(result.result);
        } catch (e) {
          reject(e);
        }
      },
      fail: (err) => {
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
    const deviceId = plus.device.uuid;
    uniCloud.callFunction({
      name: 'login',
      data: {
        scene: 'app',
        deviceId: deviceId
      }
    }).then(res => {
      resolve(res.result);
    }).catch(err => {
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
          console.log('getWxProfileAndUpdate: calling "user" cloud function with action "updateProfile"');
          // 调用 user 云函数更新用户信息
          const result = await uniCloud.callFunction({
            name: 'user',
            data: {
              action: 'updateProfile',
              token: getToken(), // 传入 token
              profile: {
                nickname: nickName,
                avatar_url: avatarUrl
              }
            }
          });

          const updateResult = result.result;

          if (updateResult.errCode === 0) {
            // 更新本地存储的用户信息
            uni.setStorageSync(USER_INFO_KEY, updateResult.data.userInfo);
            console.log('用户信息更新成功:', updateResult.data.userInfo);
            resolve(updateResult.data.userInfo);
          } else {
            uni.showToast({ title: updateResult.errMsg, icon: 'none' });
            console.error('用户信息更新失败:', updateResult.errMsg);
            reject(new Error(updateResult.errMsg));
          }
        } catch (e) {
          uni.showToast({ title: '请求失败，请重试', icon: 'none' });
          console.error('调用 user.updateProfile 云函数失败', e);
          reject(e);
        }
      },
      fail: (err) => {
        uni.showToast({ title: '您已取消授权', icon: 'none' });
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
  uni.$emit('user-logout');
  console.log('用户已退出登录');
=======
const TOKEN_KEY = 'tf24_cloud_token'
const USER_KEY = 'tf24_cloud_user'

function setStorage(key, value) {
  try {
    uni.setStorageSync(key, value)
  } catch (err) {
    console.warn('storage failed', err)
  }
}

function getStorage(key) {
  try {
    return uni.getStorageSync(key)
  } catch (err) {
    return null
  }
}

export function getSession() {
  return {
    token: getStorage(TOKEN_KEY) || '',
    user: getStorage(USER_KEY) || null
  }
}

export function saveSession({ token, user }) {
  if (token) setStorage(TOKEN_KEY, token)
  if (user) setStorage(USER_KEY, user)
  return { token, user }
}

export function clearSession() {
  try { uni.removeStorageSync(TOKEN_KEY) } catch (err) {}
  try { uni.removeStorageSync(USER_KEY) } catch (err) {}
}

function resolvePlatform() {
  // #ifdef MP-WEIXIN
  return 'mp-weixin'
  // #endif
  // #ifdef APP-ANDROID
  return 'app-android'
  // #endif
  // #ifdef APP-IOS
  return 'app-ios'
  // #endif
  // #ifdef APP-HARMONY
  return 'app-harmony'
  // #endif
  // #ifdef APP-PLUS
  return 'app-plus'
  // #endif
  return 'unknown'
}

export async function wxLogin() {
  // #ifndef MP-WEIXIN
  throw new Error('仅支持在微信小程序中调用 wxLogin')
  // #endif
  const loginRes = await uni.login({ provider: 'weixin' })
  if (!loginRes.code) {
    throw new Error('微信登录失败')
  }
  const { result } = await uniCloud.callFunction({
    name: 'login',
    data: { scene: 'mp-weixin', code: loginRes.code, platform: resolvePlatform() }
  })
  if (!result) throw new Error('云函数返回为空')
  return saveSession(result)
}

export async function appLogin() {
  // #ifndef APP-PLUS
  throw new Error('仅支持在 App 中调用 appLogin')
  // #endif
  const safePlus = typeof plus !== 'undefined' ? plus : null
  const deviceId = safePlus?.device?.uuid || safePlus?.device?.imei || ''
  if (!deviceId) {
    throw new Error('无法获取设备ID')
  }
  const { result } = await uniCloud.callFunction({
    name: 'login',
    data: { scene: 'app', deviceId, platform: resolvePlatform() }
  })
  if (!result) throw new Error('云函数返回为空')
  return saveSession(result)
}

export async function getWxProfileAndUpdate() {
  // #ifndef MP-WEIXIN
  return null
  // #endif
  const profile = await uni.getUserProfile({ desc: '用于完善资料' })
  const { token } = getSession()
  if (!token) return null
  const { result } = await uniCloud.callFunction({
    name: 'user',
    data: {
      action: 'updateProfile',
      token,
      data: {
        nickname: profile.userInfo.nickName,
        avatar_url: profile.userInfo.avatarUrl,
        gender: profile.userInfo.gender
      }
    }
  })
  if (result?.user) {
    saveSession({ token, user: result.user })
  }
  return result?.user
}

async function silentLogin() {
  const existing = getSession()
  if (existing.token) return existing
  // #ifdef MP-WEIXIN
  return await wxLogin()
  // #endif
  // #ifdef APP-PLUS
  return await appLogin()
  // #endif
  return existing
}

export async function ensureAutoLogin() {
  try {
    return await silentLogin()
  } catch (err) {
    console.warn('auto login failed', err)
    return null
  }
>>>>>>> fa14bfa889a325bfe154c355179004e5920c333b
}
