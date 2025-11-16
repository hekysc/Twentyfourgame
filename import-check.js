// 导入检查脚本
// 验证所有文件的导入语句是否正确

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const projectRoot = process.cwd()

console.log('🔍 检查导入语句...\n')

// 检查每个页面的导入
const pagesDir = join(projectRoot, 'pages')
const pageDirs = ['login', 'user', 'stats', 'index']

pageDirs.forEach(pageName => {
  const pagePath = join(pagesDir, pageName, 'index.vue')
  if (existsSync(pagePath)) {
    console.log(`📄 检查 pages/${pageName}/index.vue:`)
    
    try {
      const content = readFileSync(pagePath, 'utf8')
      const importLines = content.split('\n').filter(line => line.trim().startsWith('import'))
      
      importLines.forEach(line => {
        console.log(`  ✅ ${line.trim()}`)
        
        // 检查 cloud-store.js 的导入
        if (line.includes('cloud-store.js')) {
          const functions = line.match(/import\s*\{\s*([^}]+)\s*\}/)
          if (functions) {
            const importedFunctions = functions[1].split(',').map(f => f.trim())
            console.log(`    📦 从 cloud-store.js 导入: ${importedFunctions.join(', ')}`)
          }
        }
        
        // 检查 auth.js 的导入
        if (line.includes('auth.js')) {
          const functions = line.match(/import\s*\{\s*([^}]+)\s*\}/)
          if (functions) {
            const importedFunctions = functions[1].split(',').map(f => f.trim())
            console.log(`    🔐 从 auth.js 导入: ${importedFunctions.join(', ')}`)
          }
        }
      })
    } catch (err) {
      console.log(`  ❌ 读取文件失败: ${err.message}`)
    }
    console.log('')
  }
})

// 检查 cloud-store.js 的导出
console.log('📦 检查 utils/cloud-store.js 导出:')
const cloudStorePath = join(projectRoot, 'utils', 'cloud-store.js')
if (existsSync(cloudStorePath)) {
  try {
    const content = readFileSync(cloudStorePath, 'utf8')
    const exportLines = content.split('\n').filter(line => 
      line.trim().startsWith('export') && line.includes('function')
    )
    
    exportLines.forEach(line => {
      const match = line.match(/export\s+(?:async\s+)?function\s+(\w+)/)
      if (match) {
        console.log(`  ✅ ${match[1]}()`)
      }
    })
  } catch (err) {
    console.log(`  ❌ 读取文件失败: ${err.message}`)
  }
}

console.log('')

// 检查 auth.js 的导出
console.log('🔐 检查 utils/auth.js 导出:')
const authPath = join(projectRoot, 'utils', 'auth.js')
if (existsSync(authPath)) {
  try {
    const content = readFileSync(authPath, 'utf8')
    const exportLines = content.split('\n').filter(line => 
      line.trim().startsWith('export') && line.includes('function')
    )
    
    exportLines.forEach(line => {
      const match = line.match(/export\s+(?:async\s+)?function\s+(\w+)/)
      if (match) {
        console.log(`  ✅ ${match[1]}()`)
      }
    })
  } catch (err) {
    console.log(`  ❌ 读取文件失败: ${err.message}`)
  }
}

console.log('\n✨ 导入检查完成！')
console.log('\n📝 如果发现导入错误，请：')
console.log('  1. 检查函数名拼写是否正确')
console.log('  2. 确认函数在源文件中已导出')
console.log('  3. 验证文件路径是否正确')