const https = require('https')

const APPID = process.env.WECHAT_APPID || 'wx58faf81d08ca037c'
const APPSECRET = process.env.WECHAT_APPSECRET
const VERSION = process.env.WECHAT_VERSION
const DESC = process.env.WECHAT_DESC || ('Formal release candidate ' + VERSION)
const FIRST_CLASS = process.env.WECHAT_AUDIT_FIRST_CLASS
const SECOND_CLASS = process.env.WECHAT_AUDIT_SECOND_CLASS
const FIRST_ID = process.env.WECHAT_AUDIT_FIRST_ID
const SECOND_ID = process.env.WECHAT_AUDIT_SECOND_ID
const TAG = process.env.WECHAT_AUDIT_TAG || '24点,益智,游戏'

function fail(msg) { console.error('[wechat-audit] ' + msg); process.exit(1) }
if (!APPSECRET) fail('WECHAT_APPSECRET is required.')
if (!VERSION) fail('WECHAT_VERSION is required.')

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'api.weixin.qq.com', method, path, headers: body ? {'Content-Type':'application/json'} : {} }, res => {
      let data=''; res.on('data', d => data += d); res.on('end', () => {
        let parsed
        try { parsed=JSON.parse(data) } catch {
          const preview=String(data).replace(/[\r\n]+/g,' ').slice(0,160)
          return reject(new Error('Invalid JSON from WeChat: HTTP '+res.statusCode+' content-type='+(res.headers['content-type']||'unknown')+' body='+preview))
        }
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error('HTTP '+res.statusCode+' errcode='+(parsed.errcode??'n/a')+' errmsg='+(parsed.errmsg||'n/a')))
        resolve(parsed)
      })
    })
    req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end()
  })
}

async function token() {
  const r=await request('POST','/cgi-bin/stable_token',{
    grant_type:'client_credential',
    appid:APPID,
    secret:APPSECRET,
    force_refresh:false,
  })
  if (!r.access_token) throw new Error('Stable token failed: errcode='+r.errcode+' errmsg='+r.errmsg)
  return r.access_token
}

async function main() {
  const t=await token()
  let item
  if (FIRST_CLASS && SECOND_CLASS && FIRST_ID && SECOND_ID) {
    item={address:'pages/login/index',tag:TAG,first_class:FIRST_CLASS,second_class:SECOND_CLASS,first_id:Number(FIRST_ID),second_id:Number(SECOND_ID),title:'24点小程序'}
  } else {
    const cats=await request('GET','/wxa/get_category?access_token='+encodeURIComponent(t))
    if (cats.errcode && cats.errcode !== 0) throw new Error('get_category failed: '+cats.errcode+' '+cats.errmsg)
    const c=(cats.category_list||[])[0]
    if (!c) throw new Error('No WeChat Mini Program category is configured. Configure a service category first.')
    item={address:'pages/login/index',tag:TAG,first_class:c.first_class,second_class:c.second_class,first_id:c.first_id,second_id:c.second_id,title:'24点小程序'}
  }
  const r=await request('POST','/wxa/submit_audit?access_token='+encodeURIComponent(t),{item_list:[item],version_desc:DESC,feedback_info:'Formal release candidate '+VERSION})
  if (r.errcode !== 0) throw new Error('submit_audit failed: '+r.errcode+' '+r.errmsg)
  console.log('[wechat-audit] Submitted successfully. auditid='+r.auditid+' version='+VERSION)
}
main().catch(e=>fail(e.message||String(e)))
