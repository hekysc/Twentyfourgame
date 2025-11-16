'use strict';

// common/auth 模块用于生成和校验 token
const auth = require('common/auth');
// crypto 用于生成 UUID
const crypto = require('crypto');

const db = uniCloud.database();
const $ = db.command.aggregate;
const userCollection = db.collection('user');

// TODO: 生产环境建议通过 uni-config-center 管理密钥
const WX_APPID = 'YOUR_WX_APPID'; // 请替换为你的小程序 AppID
const WX_SECRET = 'YOUR_WX_SECRET'; // 请替换为你的小程序 AppSecret

/**
 * 工具函数：生成唯一的 User ID
 * @returns {string} UUID
 */
function generateUserId() {
  return crypto.randomUUID();
}

/**
 * 工具函数：从返回的用户信息中移除敏感字段
 * @param {object} user - 原始用户对象
 * @returns {object | null} - 清理后的用户对象
 */
function sanitizeUser(user) {
  if (!user) return null;
  const cloned = { ...user };
  // 可以在这里删除不想返回给前端的字段
  delete cloned.openid;
  delete cloned.unionid;
  return cloned;
}

/**
 * 调用微信接口 a.code2Session
 * @param {string} code - wx.login 获取的 code
 * @returns {Promise<object>} - 微信 session 对象 { openid, unionid, session_key }
 */
async function fetchWeixinSession(code) {
  if (!code) {
    throw new Error('缺少微信登录 code');
  }
  if (!WX_APPID || !WX_SECRET || WX_APPID === 'YOUR_WX_APPID') {
    throw new Error('请在云函数 login/index.js 中正确配置微信小程序的 AppID 和 AppSecret');
  }
  const resp = await uniCloud.httpclient.request('https://api.weixin.qq.com/sns/jscode2session', {
    method: 'GET',
    dataType: 'json',
    data: {
      appid: WX_APPID,
      secret: WX_SECRET,
      js_code: code,
      grant_type: 'authorization_code'
    }
  });
  if (!resp.data || resp.data.errcode) {
    throw new Error(resp.data?.errmsg || '微信登录失败，请稍后再试');
  }
  return resp.data;
}


// --- Scene Handlers ---

/**
 * 场景1: 微信小程序登录 (scene = 'mp-weixin')
 * @param {object} event - 云函数入参
 */
async function handleMpWeixinLogin({ code, platform }) {
  const weixinSession = await fetchWeixinSession(code);
  const { openid, unionid } = weixinSession;

  let userResult = await userCollection.where({ openid }).limit(1).get();
  let user = userResult.data[0];

  if (!user) {
    // 用户不存在，创建新微信账号
    const newUser = {
      _id: generateUserId(),
      account_type: 'weixin',
      openid,
      unionid: unionid || '',
      nickname: '微信用户', // 初始昵称，后续可让用户修改
      avatar_url: '', // 初始头像
      platforms: [platform],
      created_at: Date.now(),
      last_login_at: Date.now(),
      stats: { score: 0, coins: 0 }
    };
    await userCollection.add(newUser);
    user = newUser;
  } else {
    // 用户已存在，更新登录信息
    await userCollection.doc(user._id).update({
      last_login_at: Date.now(),
      platforms: db.command.addToSet(platform)
    });
    user.last_login_at = Date.now();
  }

  const token = auth.createToken({ uid: user._id });
  return { errCode: 0, token, user: sanitizeUser(user) };
}

/**
 * 场景2: 创建本机普通账号 (scene = 'create-local')
 * @param {object} event - 云函数入参
 */
async function handleCreateLocalAccount({ deviceId, platform, extra = {} }) {
  if (!deviceId) {
    return { errCode: 400, errMsg: '缺少设备ID (deviceId)' };
  }
  if (!extra.nickname) {
    return { errCode: 400, errMsg: '必须提供昵称' };
  }

  const newUser = {
    _id: generateUserId(),
    account_type: 'local',
    device_id: deviceId,
    nickname: extra.nickname,
    avatar_url: extra.avatar_url || '',
    platforms: [platform],
    created_at: Date.now(),
    last_login_at: Date.now(),
    stats: { score: 0, coins: 0 }
  };

  await userCollection.add(newUser);
  const token = auth.createToken({ uid: newUser._id });

  // 返回完整 user 对象，因为前端本地需要存储
  return { errCode: 0, token, user: newUser };
}


/**
 * 场景3: App/本机普通账号登录 (scene = 'app')
 * @param {object} event - 云函数入参
 */
async function handleAppLogin({ deviceId, user_id }) {
  if (!deviceId || !user_id) {
    return { errCode: 400, errMsg: '缺少设备ID (deviceId) 或用户ID (user_id)' };
  }

  let userResult = await userCollection.doc(user_id).get();
  const user = userResult.data[0];

  if (!user || user.account_type !== 'local') {
    return { errCode: 404, errMsg: '账号不存在或类型错误' };
  }

  if (user.device_id !== deviceId) {
    return { errCode: 403, errMsg: '此账号仅限创建设备的本机使用' };
  }

  await userCollection.doc(user_id).update({
    last_login_at: Date.now()
  });
  user.last_login_at = Date.now();

  const token = auth.createToken({ uid: user._id });
  return { errCode: 0, token, user: sanitizeUser(user) };
}

/**
 * 场景4: 普通账号升级为微信账号 (scene = 'upgrade')
 * @param {object} event - 云函数入参
 */
async function handleUpgrade({ code, user_id }) {
  const weixinSession = await fetchWeixinSession(code);
  const { openid, unionid } = weixinSession;

  const [localUserRes, weixinUserRes] = await Promise.all([
    userCollection.doc(user_id).get(),
    userCollection.where({ openid }).limit(1).get()
  ]);

  const localUser = localUserRes.data[0];
  if (!localUser || localUser.account_type !== 'local') {
    return { errCode: 404, errMsg: '要升级的普通账号不存在' };
  }

  let weixinUser = weixinUserRes.data[0];

  if (!weixinUser) {
    // 该微信未注册过，直接将普通账号升级
    await userCollection.doc(user_id).update({
      account_type: 'weixin',
      openid,
      unionid: unionid || '',
      device_id: db.command.remove() // 升级后不再需要 device_id
    });
    weixinUser = { ...localUser, account_type: 'weixin', openid };
  } else {
    // 该微信已存在账号，合并数据
    const mergedStats = {
      score: Math.max(localUser.stats.score || 0, weixinUser.stats.score || 0),
      coins: (localUser.stats.coins || 0) + (weixinUser.stats.coins || 0)
    };

    await userCollection.doc(weixinUser._id).update({
      stats: mergedStats
    });

    // 删除已合并的普通账号
    await userCollection.doc(user_id).remove();
    weixinUser.stats = mergedStats;
  }

  const token = auth.createToken({ uid: weixinUser._id });
  return { errCode: 0, token, user: sanitizeUser(weixinUser) };
}

/**
 * 场景5: 删除本机普通账号 (scene = 'delete-local')
 * @param {object} event - 云函数入参
 */
async function handleDeleteLocalAccount({ deviceId, user_id }) {
  if (!deviceId || !user_id) {
    return { errCode: 400, errMsg: '缺少设备ID (deviceId) 或用户ID (user_id)' };
  }

  const userResult = await userCollection.doc(user_id).get();
  const user = userResult.data[0];

  if (!user || user.account_type !== 'local' || user.device_id !== deviceId) {
    return { errCode: 403, errMsg: '无权删除此账号' };
  }

  await userCollection.doc(user_id).remove();
  return { errCode: 0, errMsg: '账号已删除' };
}


exports.main = async (event = {}, context) => {
  const { scene } = event;

  switch (scene) {
    case 'mp-weixin':
      return handleMpWeixinLogin(event);
    case 'create-local':
      return handleCreateLocalAccount(event);
    case 'app':
      return handleAppLogin(event);
    case 'upgrade':
      return handleUpgrade(event);
    case 'delete-local':
      return handleDeleteLocalAccount(event);
    default:
      return {
        errCode: 404,
        errMsg: '不支持的登录场景'
      };
  }
};
