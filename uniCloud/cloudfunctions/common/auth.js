'use strict';

const jwt = require('uni-jwt');
const createConfig = require('uni-config-center');

// 读取 uni-config-center 中 jwt.secret 的配置
const config = createConfig({
    pluginId: 'jwt'
}).config();

const SECRET_KEY = config.secret;

// 在云函数初始化时检查密钥是否存在，如果不存在则抛出错误，阻止不安全的操作
if (!SECRET_KEY || SECRET_KEY === 'YOUR_OWN_SECURE_JWT_SECRET_KEY_PLEASE_REPLACE') {
    throw new Error('JWT secret key is not configured or is using the default placeholder in uni-config-center. Please configure a secure key.');
}


/**
 * 生成 Token
 * @param {object} user 用户信息，至少包含 _id
 * @returns {string} 返回生成的 token
 */
function createToken(user) {
  if (!user || !user._id) {
    throw new Error('User information is invalid for token creation.');
  }

  const payload = {
    uid: user._id,
    // 可以根据需要加入更多信息，例如 role, permission 等
    // role: user.role || 'user'
  };

  const token = jwt.sign(payload, SECRET_KEY, {
    expiresIn: '7d' // Token 有效期为 7 天
  });

  return token;
}

/**
 * 校验 Token
 * @param {string} token 用户端传入的 token
 * @returns {object} 返回解码后的 payload，若校验失败则抛出异常
 */
function verifyToken(token) {
  if (!token) {
    throw new Error('Token is required.');
  }

  try {
    // uni-jwt 的 verify 方法会自动处理 Bearer 前缀
    const decoded = jwt.verify(token.replace('Bearer ', ''), SECRET_KEY);
    return decoded;
  } catch (err) {
    // Token 过期或无效
    console.error('Token verification failed:', err.message);
    throw new Error('Token is invalid or expired.');
  }
}

module.exports = {
  createToken,
  verifyToken
};
