'use strict';

const db = uniCloud.database();
const { verifyToken } = require('../common/auth');

exports.main = async (event, context) => {
  const { action, token, profile } = event;

  // 1. Token 校验
  if (!token) {
      return {
          errCode: 401,
          errMsg: '未提供 token，禁止访问'
      }
  }

  let auth;
  try {
    auth = verifyToken(token);
  } catch (e) {
    return {
      errCode: 401,
      errMsg: 'Token 校验失败，请重新登录',
    };
  }

  const uid = auth.uid;
  const dbUser = db.collection('user');

  // 2. 根据 action 分发操作
  switch (action) {
    case 'updateProfile': {
      const { nickname, avatar_url } = profile || {};
      if (!nickname && !avatar_url) {
        return { errCode: 3001, errMsg: '昵称和头像至少需要一个' };
      }

      const updateData = {};
      if (nickname) updateData.nickname = nickname;
      if (avatar_url) updateData.avatar_url = avatar_url;

      const result = await dbUser.doc(uid).update(updateData);

      if (result.updated === 1) {
        // 更新成功后，返回最新的用户信息
        const updatedUser = await dbUser.doc(uid).get();
        const userInfo = updatedUser.data[0];
        // 剔除敏感信息
        delete userInfo.openid;
        delete userInfo.unionid;
        delete userInfo.device_id;
        return {
          errCode: 0,
          errMsg: '更新成功',
          data: { userInfo },
        };
      } else {
        return { errCode: 3002, errMsg: '更新失败，用户不存在或无权限' };
      }
    }

    case 'getProfile': {
      const userResult = await dbUser.doc(uid).get();
      if (!userResult.data || userResult.data.length === 0) {
        return { errCode: 4004, errMsg: '用户不存在' };
      }
      const userInfo = userResult.data[0];
      // 剔除敏感信息
      delete userInfo.openid;
      delete userInfo.unionid;
      delete userInfo.device_id;
      return {
        errCode: 0,
        errMsg: '获取成功',
        data: { userInfo },
      };
    }

    default:
      return {
        errCode: 400,
        errMsg: '无效的操作',
      };
  }
};
