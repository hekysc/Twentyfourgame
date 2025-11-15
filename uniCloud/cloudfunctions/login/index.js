'use strict';

const db = uniCloud.database();
const { createToken } = require('../common/auth');
// 引入 uni-config-center
const createConfig = require('uni-config-center');
const weixinConfig = createConfig({
    pluginId: 'mp-weixin'
}).config();


exports.main = async (event, context) => {
  const { scene, code, deviceId } = event;
  let user;
  const dbUser = db.collection('user');
  const now = Date.now();

  switch (scene) {
    case 'mp-weixin': {
      if (!code) {
        return { errCode: 1001, errMsg: '缺少微信登录凭证 code' };
      }

      // 检查配置是否已正确加载和修改
      if (!weixinConfig.appId || !weixinConfig.appSecret || weixinConfig.appId.includes('REPLACE') || weixinConfig.appSecret.includes('REPLACE')) {
          return { errCode: 5001, errMsg: '微信小程序配置不正确，请在 uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center/config.json 中检查 appId 和 appSecret' };
      }

      // 1. 调用微信 jscode2session 接口
      const res = await uniCloud.httpclient.request('https://api.weixin.qq.com/sns/jscode2session', {
        method: 'GET',
        data: {
          appid: weixinConfig.appId,
          secret: weixinConfig.appSecret,
          js_code: code,
          grant_type: 'authorization_code',
        },
        dataType: 'json',
      });

      const data = res.data;
      if (data.errcode || !data.openid) {
        console.error('jscode2session failed:', data);
        return { errCode: 2001, errMsg: '获取微信 openid 失败' };
      }
      const { openid, unionid } = data;

      // 2. 查询或创建用户
      const userResult = await dbUser.where({ openid }).limit(1).get();

      if (userResult.data && userResult.data.length > 0) {
        user = userResult.data[0];
        const updatedData = { last_login_at: now, unionid };
        if (!user.platforms.includes('mp-weixin')) {
          updatedData.platforms = db.command.push('mp-weixin');
        }
        await dbUser.doc(user._id).update(updatedData);
      } else {
        const newUser = {
          openid,
          unionid,
          nickname: '微信用户',
          avatar_url: '',
          platforms: ['mp-weixin'],
          created_at: now,
          last_login_at: now,
        };
        const addUserResult = await dbUser.add(newUser);
        user = { _id: addUserResult.id, ...newUser };
      }
      break;
    }

    case 'app': {
      if (!deviceId) {
        return { errCode: 1002, errMsg: '缺少设备 ID' };
      }

      const userResult = await dbUser.where({ device_id: deviceId }).limit(1).get();

      if (userResult.data && userResult.data.length > 0) {
        user = userResult.data[0];
        const updatedData = { last_login_at: now };
        if (!user.platforms.includes('app')) {
          updatedData.platforms = db.command.push('app');
        }
        await dbUser.doc(user._id).update(updatedData);
      } else {
        const newUser = {
          device_id: deviceId,
          nickname: '游客',
          avatar_url: '',
          platforms: ['app'],
          created_at: now,
          last_login_at: now,
        };
        const addUserResult = await dbUser.add(newUser);
        user = { _id: addUserResult.id, ...newUser };
      }
      break;
    }

    default:
      return { errCode: 1003, errMsg: '无效的登录场景' };
  }

  const token = createToken(user);
  const userInfo = {
    _id: user._id,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    platforms: user.platforms,
  };

  return {
    errCode: 0,
    errMsg: '登录成功',
    data: {
      token: `Bearer ${token}`,
      userInfo,
    },
  };
};
