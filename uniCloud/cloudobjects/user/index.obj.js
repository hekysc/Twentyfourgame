'use strict';

const db = uniCloud.database();
const { verifyToken } = require('../cloudfunctions/common/auth');

module.exports = {
  _before: function() {
    // 获取客户端 token
    const token = this.getUniIdToken();
    if (!token) {
      throw new Error('用户未登录');
    }

    try {
      // 校验 token
      const payload = verifyToken(token);
      // 将解码后的用户信息挂载到 this 上，方便后续方法使用
      this.auth = payload;
    } catch (e) {
      throw new Error('Token 校验失败，请重新登录');
    }
  },

  /**
   * 更新用户昵称和头像
   * @param {object} profile - 包含 nickname 和 avatar_url 的对象
   * @returns {object} - 返回更新结果
   */
  async updateProfile(profile) {
    const { nickname, avatar_url } = profile;

    if (!nickname && !avatar_url) {
      return {
        errCode: 3001,
        errMsg: '昵称和头像至少需要一个',
      };
    }

    const uid = this.auth.uid;
    const updateData = {};
    if (nickname) updateData.nickname = nickname;
    if (avatar_url) updateData.avatar_url = avatar_url;

    const dbUser = db.collection('user');
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
        data: {
            userInfo
        }
      };
    } else {
      return {
        errCode: 3002,
        errMsg: '更新失败，用户不存在或无权限',
      };
    }
  },

  /**
   * 获取当前登录用户的个人信息
   */
  async getProfile() {
      const uid = this.auth.uid;
      const dbUser = db.collection('user');
      const userResult = await dbUser.doc(uid).get();

      if (!userResult.data || userResult.data.length === 0) {
          return {
              errCode: 4004,
              errMsg: '用户不存在'
          }
      }

      const userInfo = userResult.data[0];
      // 剔除敏感信息
      delete userInfo.openid;
      delete userInfo.unionid;
      delete userInfo.device_id;

      return {
          errCode: 0,
          errMsg: '获取成功',
          data: {
              userInfo
          }
      }
  }

  // 可以在这里扩展更多方法，例如：
  // bindPhone, bindWeixin 等
};
