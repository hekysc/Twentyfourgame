const fs = require('fs')
const path = require('path')
const ci = require('miniprogram-ci')

const APPID = process.env.WECHAT_APPID || 'wx58faf81d08ca037c'
const PRIVATE_KEY_PATH = process.env.WECHAT_PRIVATE_KEY_PATH
const PROJECT_PATH = path.resolve(process.env.WECHAT_PROJECT_PATH || 'unpackage/dist/build/mp-weixin')
const VERSION = process.env.WECHAT_VERSION
const DESC = process.env.WECHAT_DESC || 'Automated upload from Twentyfourgame'
const ROBOT = Number(process.env.WECHAT_CI_ROBOT || 1)
const isPreview = process.argv.includes('--preview')

function fail(message) {
  console.error('[wechat-ci] ' + message)
  process.exit(1)
}

if (!PRIVATE_KEY_PATH) fail('WECHAT_PRIVATE_KEY_PATH is required.')
if (!VERSION) fail('WECHAT_VERSION is required.')
if (!fs.existsSync(PRIVATE_KEY_PATH)) fail('Private key file does not exist: ' + PRIVATE_KEY_PATH)
if (!fs.existsSync(PROJECT_PATH)) fail('Compiled mp-weixin directory does not exist: ' + PROJECT_PATH)
if (!fs.existsSync(path.join(PROJECT_PATH, 'project.config.json'))) {
  fail('project.config.json not found in compiled mp-weixin directory. Build the project first.')
}

const project = new ci.Project({
  appid: APPID,
  type: 'miniProgram',
  projectPath: PROJECT_PATH,
  privateKeyPath: path.resolve(PRIVATE_KEY_PATH),
  ignores: ['node_modules/**/*'],
})

async function main() {
  if (isPreview) {
    const output = path.resolve(process.env.WECHAT_QR_PATH || 'wechat-preview.jpg')
    await ci.preview({
      project,
      desc: DESC,
      setting: { es6: true, minify: true },
      qrcodeFormat: 'image',
      qrcodeOutputDest: output,
      onProgressUpdate: console.log,
    })
    console.log('[wechat-ci] Preview QR generated: ' + output)
    return
  }

  const result = await ci.upload({
    project,
    version: VERSION,
    desc: DESC,
    robot: ROBOT,
    setting: { es6: true, minify: true },
    onProgressUpdate: console.log,
  })
  console.log('[wechat-ci] Upload completed.')
  if (result && result.subPackageInfo) console.log(result.subPackageInfo)
}

main().catch(err => {
  console.error('[wechat-ci] Failed:', err && (err.stack || err.message || err))
  process.exit(1)
})
