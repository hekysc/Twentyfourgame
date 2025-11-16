// 编译检查脚本
// 用于检查项目文件结构和潜在问题

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

const projectRoot = process.cwd()

console.log('🔍 开始检查项目编译状态...\n')

// 检查关键文件
const criticalFiles = [
  'App.vue',
  'main.js',
  'manifest.json',
  'pages.json',
  'uni.scss'
]

console.log('📁 检查关键文件:')
criticalFiles.forEach(file => {
  const exists = existsSync(join(projectRoot, file))
  console.log(`  ${exists ? '✅' : '❌'} ${file}`)
})

// 检查页面文件
console.log('\n📄 检查页面文件:')
const pagesDir = join(projectRoot, 'pages')
if (existsSync(pagesDir)) {
  const pages = readdirSync(pagesDir)
  pages.forEach(page => {
    const indexPath = join(pagesDir, page, 'index.vue')
    if (existsSync(indexPath)) {
      console.log(`  ✅ pages/${page}/index.vue`)
      
      // 检查是否有 SCSS 导入问题
      try {
        const content = readFileSync(indexPath, 'utf8')
        if (content.includes('@import') && content.includes('variables.scss')) {
          console.log(`    ⚠️  发现 variables.scss 导入`)
        }
        if (content.includes('lang="scss"')) {
          console.log(`    ⚠️  发现 SCSS 语法`)
        }
      } catch (err) {
        console.log(`    ❌ 读取文件失败`)
      }
    } else {
      console.log(`  ❌ pages/${page}/index.vue (不存在)`)
    }
  })
}

// 检查 utils 目录
console.log('\n🔧 检查工具文件:')
const utilsDir = join(projectRoot, 'utils')
if (existsSync(utilsDir)) {
  const utils = readdirSync(utilsDir)
  utils.forEach(file => {
    console.log(`  ✅ utils/${file}`)
  })
}

// 检查 uniCloud 目录
console.log('\n☁️  检查云服务:')
const uniCloudDir = join(projectRoot, 'uniCloud')
if (existsSync(uniCloudDir)) {
  const cloudDirs = ['cloudfunctions', 'database']
  cloudDirs.forEach(dir => {
    const fullPath = join(uniCloudDir, dir)
    if (existsSync(fullPath)) {
      console.log(`  ✅ uniCloud/${dir}`)
      if (dir === 'cloudfunctions') {
        const functions = readdirSync(fullPath)
        functions.forEach(func => {
          console.log(`    📦 ${func}`)
        })
      }
      if (dir === 'database') {
        const schemas = readdirSync(fullPath)
        schemas.forEach(schema => {
          console.log(`    📄 ${schema}`)
        })
      }
    } else {
      console.log(`  ❌ uniCloud/${dir} (不存在)`)
    }
  })
}

// 检查组件目录
console.log('\n🧩 检查组件:')
const componentsDir = join(projectRoot, 'components')
if (existsSync(componentsDir)) {
  const components = readdirSync(componentsDir)
  components.forEach(comp => {
    console.log(`  ✅ components/${comp}`)
  })
}

// 检查样式文件
console.log('\n🎨 检查样式文件:')
const stylesDir = join(projectRoot, 'styles')
if (existsSync(stylesDir)) {
  const styles = readdirSync(stylesDir)
  styles.forEach(style => {
    console.log(`  ✅ styles/${style}`)
  })
} else {
  console.log('  ❌ styles 目录不存在')
}

console.log('\n✨ 检查完成！')
console.log('\n📝 提示:')
console.log('  • 如果遇到 SCSS 导入错误，请确保所有 @import 语句路径正确')
console.log('  • 建议使用普通 CSS 代替 SCSS 以避免编译问题')
console.log('  • 在 HBuilderX 中重新编译项目')
console.log('  • 确保微信小程序 AppID 已在 manifest.json 中配置')

// 输出编译建议
console.log('\n🚀 编译建议:')
console.log('  1. 在 HBuilderX 中打开项目')
console.log('  2. 选择"运行" -> "运行到微信开发者工具"')
console.log('  3. 或选择"发行" -> "小程序-微信"进行打包')
console.log('  4. 确保已配置微信小程序 AppID')