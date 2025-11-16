// 云端功能测试脚本
// 在浏览器控制台或 HBuilderX 控制台中运行

import { 
  wxLogin, 
  appLogin, 
  getSession, 
  getWxProfileAndUpdate 
} from './utils/auth.js'

import { 
  getCurrentUser, 
  pushRound, 
  readStats, 
  readStatsExtended,
  updateUserProfile,
  allUsersWithStats
} from './utils/cloud-store.js'

// 测试用例集合
export const CloudTests = {
  // 测试登录功能
  async testLogin() {
    console.log('🧪 开始测试登录功能')
    
    try {
      // #ifdef MP-WEIXIN
      const session = await wxLogin()
      console.log('✅ 微信登录成功', session)
      // #endif
      
      // #ifdef APP-PLUS
      const session = await appLogin()
      console.log('✅ App登录成功', session)
      // #endif
      
      return true
    } catch (error) {
      console.error('❌ 登录失败', error)
      return false
    }
  },
  
  // 测试获取用户信息
  async testGetUser() {
    console.log('🧪 开始测试获取用户信息')
    
    try {
      const user = await getCurrentUser()
      if (user) {
        console.log('✅ 获取用户信息成功', user)
        return true
      } else {
        console.log('❌ 用户信息为空')
        return false
      }
    } catch (error) {
      console.error('❌ 获取用户信息失败', error)
      return false
    }
  },
  
  // 测试保存游戏记录
  async testSaveGameRecord() {
    console.log('🧪 开始测试保存游戏记录')
    
    try {
      // 测试保存成功的游戏记录
      const successRecord = {
        success: true,
        timeMs: 30000,
        hintUsed: false,
        retries: 2,
        ops: ['+', '-', '×', '÷'],
        exprLen: 7,
        maxDepth: 3,
        faceUseHigh: true,
        hand: {
          cards: [
            { rank: 1, suit: 'S' },
            { rank: 2, suit: 'H' },
            { rank: 3, suit: 'D' },
            { rank: 4, suit: 'C' }
          ]
        },
        solutionsCount: 2,
        expr: '1+2+3+4'
      }
      
      await pushRound(successRecord)
      console.log('✅ 成功游戏记录保存成功')
      
      // 测试保存失败的游戏记录
      const failRecord = {
        success: false,
        timeMs: 60000,
        hintUsed: true,
        retries: 5
      }
      
      await pushRound(failRecord)
      console.log('✅ 失败游戏记录保存成功')
      
      return true
    } catch (error) {
      console.error('❌ 保存游戏记录失败', error)
      return false
    }
  },
  
  // 测试读取统计数据
  async testReadStats() {
    console.log('🧪 开始测试读取统计数据')
    
    try {
      const stats = await readStats()
      console.log('✅ 基础统计数据', stats)
      
      const extendedStats = await readStatsExtended()
      console.log('✅ 扩展统计数据', extendedStats)
      
      return true
    } catch (error) {
      console.error('❌ 读取统计数据失败', error)
      return false
    }
  },
  
  // 测试更新用户信息
  async testUpdateUser() {
    console.log('🧪 开始测试更新用户信息')
    
    try {
      // 测试更新昵称
      await updateUserProfile({ 
        nickname: '测试用户' + Date.now() 
      })
      console.log('✅ 更新昵称成功')
      
      // 测试更新头像
      await updateUserProfile({ 
        avatar_url: 'https://example.com/avatar.jpg' 
      })
      console.log('✅ 更新头像成功')
      
      // 测试更新用户设置
      await updateUserProfile({ 
        settings: { 
          color: '#fde68a',
          mode: 'pro',
          face_use_high: true 
        } 
      })
      console.log('✅ 更新用户设置成功')
      
      return true
    } catch (error) {
      console.error('❌ 更新用户信息失败', error)
      return false
    }
  },
  
  // 测试数据同步
  async testSync() {
    console.log('🧪 开始测试数据同步')
    
    try {
      // 获取当前会话
      const session = getSession()
      console.log('📋 当前会话信息', session)
      
      // 获取用户列表（用于排行榜）
      const usersWithStats = await allUsersWithStats()
      console.log('📊 用户排行榜数据', usersWithStats)
      
      return true
    } catch (error) {
      console.error('❌ 数据同步测试失败', error)
      return false
    }
  },
  
  // 运行所有测试
  async runAllTests() {
    console.log('🚀 开始运行所有云端功能测试')
    
    const results = {
      login: await this.testLogin(),
      getUser: await this.testGetUser(),
      saveRecord: await this.testSaveGameRecord(),
      readStats: await this.testReadStats(),
      updateUser: await this.testUpdateUser(),
      sync: await this.testSync()
    }
    
    const passed = Object.values(results).filter(Boolean).length
    const total = Object.keys(results).length
    
    console.log(`📋 测试结果: ${passed}/${total} 通过`)
    console.table(results)
    
    return results
  }
}

// 导出测试函数供控制台使用
if (typeof window !== 'undefined') {
  window.CloudTests = CloudTests
  console.log('💡 使用 CloudTests.runAllTests() 运行所有测试')
}

// 使用示例:
// 1. 在浏览器控制台运行: CloudTests.runAllTests()
// 2. 单独测试某个功能: CloudTests.testLogin()
// 3. 查看测试结果: 查看控制台输出的表格