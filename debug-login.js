// 微信登录调试脚本
// 用于诊断微信登录失败问题

console.log('🔍 开始诊断微信登录问题...\n')

// 检查 manifest.json 配置
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const projectRoot = process.cwd()

console.log('📋 检查 manifest.json 配置:')
const manifestPath = join(projectRoot, 'manifest.json')
if (existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const mpWeixin = manifest['mp-weixin']
    
    if (mpWeixin) {
      console.log(`  ✅ 找到 mp-weixin 配置`)
      console.log(`  📱 AppID: ${mpWeixin.appid || '❌ 未配置'}`)
      console.log(`  🌐 networkTimeout: ${JSON.stringify(mpWeixin.networkTimeout || '未配置')}`)
      console.log(`  🔐 setting: ${JSON.stringify(mpWeixin.setting || '未配置')}`)
    } else {
      console.log(`  ❌ 未找到 mp-weixin 配置`)
    }
  } catch (err) {
    console.log(`  ❌ 读取 manifest.json 失败: ${err.message}`)
  }
} else {
  console.log(`  ❌ manifest.json 文件不存在`)
}

console.log('\n🔧 检查云函数配置:')
const loginIndexPath = join(projectRoot, 'uniCloud', 'cloudfunctions', 'login', 'index.js')
if (existsSync(loginIndexPath)) {
  try {
    const loginCode = readFileSync(loginIndexPath, 'utf8')
    
    // 检查环境变量使用
    const hasEnvVars = loginCode.includes('process.env.WX_APPID') && 
                      loginCode.includes('process.env.WX_SECRET')
    
    console.log(`  ${hasEnvVars ? '✅' : '❌'} 云函数使用环境变量`)
    
    // 检查微信 API URL
    const hasWxApi = loginCode.includes('api.weixin.qq.com/sns/jscode2session')
    console.log(`  ${hasWxApi ? '✅' : '❌'} 使用正确的微信 API`)
    
    // 检查错误处理
    const hasErrorHandling = loginCode.includes('errcode') && 
                            loginCode.includes('errmsg')
    console.log(`  ${hasErrorHandling ? '✅' : '❌'} 包含错误处理`)
    
  } catch (err) {
    console.log(`  ❌ 读取云函数失败: ${err.message}`)
  }
} else {
  console.log(`  ❌ 云函数 login/index.js 不存在`)
}

console.log('\n🔐 检查认证相关文件:')
const authPath = join(projectRoot, 'utils', 'auth.js')
if (existsSync(authPath)) {
  try {
    const authCode = readFileSync(authPath, 'utf8')
    
    // 检查微信登录函数
    const hasWxLogin = authCode.includes('export async function wxLogin')
    console.log(`  ${hasWxLogin ? '✅' : '❌'} 包含 wxLogin 函数`)
    
    // 检查云函数调用
    const hasCloudFunction = authCode.includes('uniCloud.callFunction')
    console.log(`  ${hasCloudFunction ? '✅' : '❌'} 调用云函数`)
    
    // 检查场景检测
    const hasSceneCheck = authCode.includes('#ifdef MP-WEIXIN')
    console.log(`  ${hasSceneCheck ? '✅' : '❌'} 包含平台条件编译`)
    
  } catch (err) {
    console.log(`  ❌ 读取 auth.js 失败: ${err.message}`)
  }
} else {
  console.log(`  ❌ utils/auth.js 不存在`)
}

console.log('\n📊 可能的问题和解决方案:')

console.log('\n1. 🔧 uniCloud 配置问题:')
console.log('   检查 uniCloud 控制台中的云函数环境变量:')
console.log('   - WX_APPID: 你的微信小程序 AppID')
console.log('   - WX_SECRET: 你的微信小程序 AppSecret')

console.log('\n2. 🔐 微信小程序密钥问题:')
console.log('   登录微信公众平台:')
console.log('   - 开发管理 → 开发设置 → 服务器配置')
console.log('   - 获取 AppID 和 AppSecret')
console.log('   - 确保小程序已认证（个人主体可能有限制）')

console.log('\n3. 🔗 网络请求问题:')
console.log('   在微信开发者工具中:')
console.log('   - 详情 → 本地设置 → 不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书')
console.log('   - 或者配置 request 合法域名到 https://api.weixin.qq.com')

console.log('\n4. 🔍 调试方法:')
console.log('   在微信开发者工具中查看网络请求:')
console.log('   - Network 标签页 → 查看云函数调用详情')
console.log('   - Console 标签页 → 查看具体错误信息')

console.log('\n5. 🧪 测试步骤:')
console.log('   1. 确认微信开发者工具已登录微信账号')
console.log('   2. 确认项目 AppID 配置正确')
console.log('   3. 确认 uniCloud 服务空间已关联')
console.log('   4. 确认云函数已部署')

console.log('\n✨ 诊断完成！')
console.log('\n💡 如果问题仍然存在，请:')
console.log('   1. 查看微信开发者工具控制台的具体错误信息')
console.log('   2. 检查 uniCloud 控制台的云函数日志')
console.log('   3. 确认微信小程序账号状态和权限')