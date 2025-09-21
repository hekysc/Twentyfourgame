import { getUsers, setUsers, setUserAvatar } from './store.js'
import { writeAvatarMeta, clearAvatarMeta } from './prefs.js'

export const MAX_AVATAR_SIZE = 2 * 1024 * 1024
export const AVATAR_NOTICE_KEY = 'tf24_avatar_restore_notice'

const DEFAULT_AVATAR_SIZE = 160

const DEFAULT_THEME = Object.freeze({
  uri: '',
  palette: {
    primary: '#e2e8f0',
    secondary: '#cbd5f5',
    soft: '#f8fafc',
    accent: '#38bdf8',
    overlay: '#0ea5e9',
    border: '#cbd5f5',
    badge: '#1d4ed8',
    altBadge: '#6366f1',
    badgeText: '#ffffff',
    text: '#0f172a',
    highlight: '#e0f2fe',
    pattern: '#a5b4fc'
  },
  panelGradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 60%, #cbd5f5 100%)',
  badgeGradient: 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 100%)',
  altBadgeGradient: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
  borderColor: '#cbd5f5',
  shadow: '0 24rpx 48rpx rgba(148,163,184,0.35)',
  badgeShadow: 'rgba(59,130,246,0.35)',
  softShadow: 'rgba(148,163,184,0.25)'
})

const avatarThemeCache = new Map()

function hashSeed(seed) {
  const text = String(seed || 'tf24-default')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 131 + text.charCodeAt(i)) >>> 0
  }
  return hash >>> 0
}

function hslToHex(h, s, l) {
  let _h = h
  while (_h < 0) _h += 360
  _h = _h % 360
  const _s = Math.max(0, Math.min(100, s)) / 100
  const _l = Math.max(0, Math.min(100, l)) / 100
  const c = (1 - Math.abs(2 * _l - 1)) * _s
  const hp = _h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let [r, g, b] = [0, 0, 0]
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0]
  else if (hp >= 1 && hp < 2) [r, g, b] = [x, c, 0]
  else if (hp >= 2 && hp < 3) [r, g, b] = [0, c, x]
  else if (hp >= 3 && hp < 4) [r, g, b] = [0, x, c]
  else if (hp >= 4 && hp < 5) [r, g, b] = [x, 0, c]
  else if (hp >= 5 && hp < 6) [r, g, b] = [c, 0, x]
  const m = _l - c / 2
  const toHex = (v) => {
    const n = Math.round((v + m) * 255)
    const hex = n.toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToRgb(hex) {
  const value = String(hex || '').trim()
  if (!value) return { r: 0, g: 0, b: 0 }
  let normalized = value.replace(/^#/, '')
  if (normalized.length === 3) {
    normalized = normalized.split('').map((c) => c + c).join('')
  }
  if (normalized.length !== 6) return { r: 0, g: 0, b: 0 }
  const num = parseInt(normalized, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  }
}

function hexToRgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r},${g},${b},${a})`
}

function encodeSvgDataUrl(svg) {
  if (!svg) return ''
  try {
    if (typeof btoa === 'function') {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
    }
  } catch (_) {}
  try {
    if (typeof Buffer !== 'undefined') {
      return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
    }
  } catch (_) {}
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
    let str = unescape(encodeURIComponent(svg))
    let output = ''
    for (let block = 0, charCode, i = 0, map = chars; str.charAt(i || 0);) {
      charCode = str.charCodeAt(i += 1)
      block = (block << 8) | charCode
      const bitLength = i % 3 * 8
      for (let j = 18; j >= bitLength; j -= 6) {
        output += map.charAt((block >> j) & 63)
      }
    }
    const padding = str.length % 3
    return `data:image/svg+xml;base64,${output}${padding ? '='.repeat(3 - padding) : ''}`
  } catch (_) {
    return ''
  }
}

export function generateDefaultAvatar(seed, options = {}) {
  const size = Number.isFinite(options.size) ? Math.max(48, Math.min(512, options.size)) : DEFAULT_AVATAR_SIZE
  const cacheKey = `${seed || 'default'}|${size}`
  if (avatarThemeCache.has(cacheKey)) {
    return avatarThemeCache.get(cacheKey)
  }
  try {
    const hash = hashSeed(seed)
    const baseHue = hash % 360
    const accentHue = (baseHue + 180 + ((hash >> 5) % 30)) % 360
    const overlayHue = (baseHue + 320 + ((hash >> 7) % 20)) % 360
    const primary = hslToHex(baseHue, 65, 58)
    const secondary = hslToHex((baseHue + 28) % 360, 68, 64)
    const soft = hslToHex((baseHue + 10) % 360, 45, 90)
    const accent = hslToHex(accentHue, 62, 52)
    const overlay = hslToHex((accentHue + 40) % 360, 70, 68)
    const border = hslToHex((accentHue + 310) % 360, 48, 42)
    const badge = hslToHex(overlayHue, 68, 55)
    const altBadge = hslToHex((overlayHue + 22) % 360, 62, 58)
    const highlight = hslToHex((baseHue + 16) % 360, 60, 72)
    const pattern = hslToHex((baseHue + 96) % 360, 60, 66)
    const gradId = `g${hash.toString(16)}_${size}`
    const radius = Math.round(size * 0.24)
    const crestY = size * (0.52 + ((hash >> 11) % 18) / 100)
    const crestCtrl = size * (0.18 + ((hash >> 14) % 20) / 100)
    const accentRadius = size * (0.18 + ((hash >> 4) % 18) / 100)
    const accentX = size * (0.28 + ((hash >> 18) % 20) / 100)
    const accentY = size * (0.32 + ((hash >> 21) % 12) / 100)
    const overlayPath = `M0 ${crestY} C ${size * 0.22} ${crestY - crestCtrl}, ${size * 0.64} ${crestY + crestCtrl}, ${size} ${crestY - crestCtrl * 0.6} L ${size} ${size} L 0 ${size} Z`
    const patternPath = `M0 ${crestY + size * 0.08} C ${size * 0.35} ${crestY + crestCtrl * 0.6}, ${size * 0.68} ${crestY - crestCtrl * 0.35}, ${size} ${crestY + crestCtrl * 0.35} L ${size} ${size} L 0 ${size} Z`
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${soft}" />
      <stop offset="${45 + (hash % 20)}%" stop-color="${primary}" />
      <stop offset="100%" stop-color="${secondary}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#${gradId})" />
  <circle cx="${accentX}" cy="${accentY}" r="${accentRadius}" fill="${accent}" fill-opacity="0.82" />
  <path d="${overlayPath}" fill="${overlay}" fill-opacity="0.45" />
  <path d="${patternPath}" fill="${pattern}" fill-opacity="0.28" />
  <circle cx="${size * 0.82}" cy="${size * 0.78}" r="${size * 0.22}" fill="${badge}" fill-opacity="0.36" />
  <g transform="translate(${size * 0.12} ${size * 0.12}) rotate(${hash % 360} ${size * 0.25} ${size * 0.25})" opacity="0.18">
    <rect width="${size * 0.28}" height="${size * 0.28}" rx="${size * 0.06}" fill="${pattern}" />
    <rect x="${size * 0.18}" y="${size * 0.18}" width="${size * 0.18}" height="${size * 0.18}" rx="${size * 0.05}" fill="${accent}" />
  </g>
</svg>`
    const uri = encodeSvgDataUrl(svg)
    const theme = {
      uri,
      palette: {
        primary,
        secondary,
        soft,
        accent,
        overlay,
        border,
        badge,
        altBadge,
        badgeText: '#ffffff',
        text: '#0f172a',
        highlight,
        pattern
      },
      panelGradient: `linear-gradient(135deg, ${soft} 0%, ${highlight} 42%, ${primary} 100%)`,
      badgeGradient: `linear-gradient(135deg, ${accent} 0%, ${badge} 100%)`,
      altBadgeGradient: `linear-gradient(135deg, ${overlay} 0%, ${secondary} 100%)`,
      borderColor: border,
      shadow: `0 24rpx 48rpx ${hexToRgba(border, 0.32)}`,
      badgeShadow: hexToRgba(accent, 0.35),
      softShadow: hexToRgba(primary, 0.18)
    }
    avatarThemeCache.set(cacheKey, theme)
    return theme
  } catch (_) {
    avatarThemeCache.set(cacheKey, DEFAULT_THEME)
    return DEFAULT_THEME
  }
}

function getFS() {
  try {
    if (typeof uni !== 'undefined' && typeof uni.getFileSystemManager === 'function') {
      return uni.getFileSystemManager()
    }
  } catch (_) {}
  return null
}

function isPlusAvailable() {
  try { return typeof plus !== 'undefined' && plus && plus.io } catch (_) { return false }
}

function extractExt(path, fallback = '.png') {
  if (!path) return fallback
  const m = /\.(jpg|jpeg|png|webp)$/i.exec(path)
  return m ? `.${m[1].toLowerCase()}` : fallback
}

function composeAvatarDir() {
  try {
    if (isPlusAvailable()) return '_doc/profile'
    if (typeof uni !== 'undefined' && uni.env && uni.env.USER_DATA_PATH) {
      return `${uni.env.USER_DATA_PATH}/profile`
    }
    if (typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH) {
      return `${wx.env.USER_DATA_PATH}/profile`
    }
  } catch (_) {}
  return ''
}

async function ensureDir(dirPath) {
  if (!dirPath) return false
  const fs = getFS()
  if (fs && typeof fs.access === 'function' && typeof fs.mkdir === 'function') {
    return await new Promise(resolve => {
      fs.access({ path: dirPath, success: () => resolve(true), fail: () => {
        fs.mkdir({ dirPath, recursive: true, success: () => resolve(true), fail: () => resolve(false) })
      } })
    })
  }
  if (fs && typeof fs.mkdirSync === 'function') {
    try { fs.mkdirSync(dirPath, true); return true } catch (_) { return false }
  }
  if (isPlusAvailable()) {
    return await new Promise(resolve => {
      try {
        plus.io.resolveLocalFileSystemURL('_doc/', root => {
          const rel = dirPath.replace(/^_doc\/?/, '')
          if (!rel) { resolve(true); return }
          const segments = rel.split('/').filter(Boolean)
          let current = root
          function next(i) {
            if (i >= segments.length) { resolve(true); return }
            const name = segments[i]
            try {
              current.getDirectory(name, { create: true }, dir => { current = dir; next(i + 1) }, () => resolve(false))
            } catch (_) {
              resolve(false)
            }
          }
          next(0)
        }, () => resolve(false))
      } catch (_) { resolve(false) }
    })
  }
  return false
}

async function fileExists(path) {
  if (!path) return false
  const fs = getFS()
  if (fs && typeof fs.access === 'function') {
    return await new Promise(resolve => {
      fs.access({ path, success: () => resolve(true), fail: () => resolve(false) })
    })
  }
  if (fs && typeof fs.accessSync === 'function') {
    try { fs.accessSync(path); return true } catch (_) { return false }
  }
  if (fs && typeof fs.stat === 'function') {
    return await new Promise(resolve => {
      fs.stat({ path, success: () => resolve(true), fail: () => resolve(false) })
    })
  }
  if (isPlusAvailable()) {
    return await new Promise(resolve => {
      try { plus.io.resolveLocalFileSystemURL(path, () => resolve(true), () => resolve(false)) } catch (_) { resolve(false) }
    })
  }
  return false
}

async function removeFile(path) {
  if (!path) return false
  const fs = getFS()
  if (fs && typeof fs.unlink === 'function') {
    return await new Promise(resolve => {
      fs.unlink({ filePath: path, success: () => resolve(true), fail: () => resolve(false) })
    })
  }
  if (fs && typeof fs.unlinkSync === 'function') {
    try { fs.unlinkSync(path); return true } catch (_) { return false }
  }
  if (isPlusAvailable()) {
    return await new Promise(resolve => {
      try {
        plus.io.resolveLocalFileSystemURL(path, entry => {
          entry.remove(() => resolve(true), () => resolve(false))
        }, () => resolve(false))
      } catch (_) { resolve(false) }
    })
  }
  return false
}

async function copyFile(src, dest) {
  if (!src || !dest) return false
  const fs = getFS()
  if (fs && typeof fs.copyFile === 'function') {
    return await new Promise(resolve => {
      fs.copyFile({ srcPath: src, destPath: dest, success: () => resolve(true), fail: () => resolve(false) })
    })
  }
  if (fs && typeof fs.copyFileSync === 'function') {
    try { fs.copyFileSync(src, dest); return true } catch (_) {}
  }
  if (fs && typeof fs.readFile === 'function' && typeof fs.writeFile === 'function') {
    const data = await new Promise(resolve => {
      fs.readFile({ filePath: src, encoding: 'binary', success: res => resolve(res.data), fail: () => resolve(null) })
    })
    if (data == null) return false
    return await new Promise(resolve => {
      fs.writeFile({ filePath: dest, data, encoding: 'binary', success: () => resolve(true), fail: () => resolve(false) })
    })
  }
  if (isPlusAvailable()) {
    return await new Promise(resolve => {
      try {
        plus.io.resolveLocalFileSystemURL(src, entry => {
          const dir = dest.substring(0, dest.lastIndexOf('/')) || '_doc'
          const name = dest.substring(dest.lastIndexOf('/') + 1)
          ensureDir(dir).then(ok => {
            if (!ok) { resolve(false); return }
            try {
              plus.io.resolveLocalFileSystemURL(dir, dirEntry => {
                const attemptCopy = () => {
                  entry.copyTo(dirEntry, name, () => resolve(true), () => resolve(false))
                }
                dirEntry.getFile(name, { create: false }, fileEntry => {
                  fileEntry.remove(() => attemptCopy(), () => attemptCopy())
                }, () => attemptCopy())
              }, () => resolve(false))
            } catch (_) { resolve(false) }
          })
        }, () => resolve(false))
      } catch (_) { resolve(false) }
    })
  }
  return false
}

async function getFileInfo(path) {
  if (!path) return null
  const fs = getFS()
  if (fs && typeof fs.stat === 'function') {
    return await new Promise(resolve => {
      fs.stat({ path, success: res => resolve({ size: res.size || 0, lastModified: res.mtime || res.lastModifiedTime || Date.now() }), fail: () => resolve(null) })
    })
  }
  if (fs && typeof fs.getFileInfo === 'function') {
    return await new Promise(resolve => {
      fs.getFileInfo({ filePath: path, success: res => resolve({ size: res.size || 0, lastModified: res.lastModifiedTime || Date.now() }), fail: () => resolve(null) })
    })
  }
  if (isPlusAvailable()) {
    return await new Promise(resolve => {
      try {
        plus.io.resolveLocalFileSystemURL(path, entry => {
          entry.getMetadata(meta => {
            const size = meta.size || 0
            const lastModified = meta.modificationTime instanceof Date ? meta.modificationTime.getTime() : Date.now()
            resolve({ size, lastModified })
          }, () => resolve(null))
        }, () => resolve(null))
      } catch (_) { resolve(null) }
    })
  }
  return null
}

async function saveFileFallback(tempPath) {
  if (!tempPath) return ''
  if (typeof uni !== 'undefined' && typeof uni.saveFile === 'function') {
    return await new Promise(resolve => {
      uni.saveFile({ tempFilePath: tempPath, success: res => resolve(res && res.savedFilePath ? res.savedFilePath : ''), fail: () => resolve('') })
    })
  }
  return ''
}

async function compressImage(path, quality) {
  if (!path) return { ok: false, path, size: 0 }
  if (typeof uni === 'undefined' || typeof uni.compressImage !== 'function') {
    return { ok: false, path, size: 0 }
  }
  return await new Promise(resolve => {
    uni.compressImage({
      src: path,
      quality,
      success: res => {
        const newPath = res && res.tempFilePath ? res.tempFilePath : path
        getFileInfo(newPath).then(info => {
          resolve({ ok: true, path: newPath, size: info ? info.size || 0 : 0 })
        })
      },
      fail: () => resolve({ ok: false, path, size: 0 })
    })
  })
}

function withinAvatarDir(path) {
  if (!path) return false
  const dir = composeAvatarDir()
  if (!dir) return false
  return path.startsWith(dir)
}

async function copyIntoAvatarDir(userId, sourcePath, options = {}) {
  const dir = composeAvatarDir()
  if (!dir) return { ok: false, path: '', lastModified: 0 }
  const ensured = await ensureDir(dir)
  if (!ensured) return { ok: false, path: '', lastModified: 0 }
  const ext = options.ext || extractExt(sourcePath)
  const dest = `${dir}/avatar_${userId}${ext}`
  const copied = await copyFile(sourcePath, dest)
  if (!copied) return { ok: false, path: '', lastModified: 0 }
  const info = await getFileInfo(dest)
  return { ok: true, path: dest, lastModified: info ? info.lastModified || Date.now() : Date.now() }
}

async function prepareSource(tempPath, sizeHint) {
  if (!tempPath) return { path: '', size: 0 }
  let size = Number.isFinite(sizeHint) ? sizeHint : 0
  if (!size) {
    const info = await getFileInfo(tempPath)
    size = info ? info.size || 0 : 0
  }
  if (size > MAX_AVATAR_SIZE) {
    let currentPath = tempPath
    for (const quality of [80, 60, 45]) {
      const res = await compressImage(currentPath, quality)
      if (res.ok && res.size > 0) {
        currentPath = res.path
        size = res.size
        if (size <= MAX_AVATAR_SIZE) {
          return { path: currentPath, size }
        }
      }
    }
    return { path: currentPath, size }
  }
  return { path: tempPath, size }
}

function legacyCandidates(user) {
  const list = []
  if (!user) return list
  const id = user.id
  const avatar = user.avatar
  if (avatar) list.push(avatar)
  const legacyBase = composeAvatarDir().replace(/profile$/, '') || ''
  if (legacyBase) {
    list.push(`${legacyBase}Documents/app/avatar_${id}.png`)
    list.push(`${legacyBase}Documents/app/avatar.png`)
  }
  list.push(`_doc/avatar_${id}.png`)
  list.push(`_doc/avatar.png`)
  return Array.from(new Set(list.filter(Boolean)))
}

export async function saveAvatarForUser(userId, tempPath, options = {}) {
  if (!userId || !tempPath) return { ok: false, error: 'invalid', path: '', lastModified: 0 }
  const users = getUsers()
  const user = (users.list || []).find(u => u && u.id === userId)
  if (!user) return { ok: false, error: 'not_found', path: '', lastModified: 0 }
  const prepared = await prepareSource(tempPath, options.size)
  if (!prepared.path) return { ok: false, error: 'invalid', path: '', lastModified: 0 }
  let workingPath = prepared.path
  let stored = { ok: false, path: '', lastModified: 0 }
  if (prepared.size && prepared.size <= MAX_AVATAR_SIZE) {
    stored = await copyIntoAvatarDir(userId, workingPath, { ext: extractExt(tempPath) })
  } else {
    stored = await copyIntoAvatarDir(userId, workingPath, { ext: extractExt(tempPath) })
  }
  if (!stored.ok || !stored.path) {
    const fallback = await saveFileFallback(workingPath)
    if (fallback) {
      const info = await getFileInfo(fallback)
      stored = { ok: true, path: fallback, lastModified: info ? info.lastModified || Date.now() : Date.now() }
    }
  }
  if (!stored.ok || !stored.path) {
    return { ok: false, error: 'fs_failed', path: '', lastModified: 0 }
  }
  const prev = user.avatar || ''
  if (prev && prev !== stored.path) {
    await removeFile(prev)
  }
  setUserAvatar(userId, stored.path, stored.lastModified)
  writeAvatarMeta(userId, { uri: stored.path, lastModified: stored.lastModified })
  return stored
}

export async function removeAvatarForUser(userId) {
  if (!userId) return { ok: false }
  const users = getUsers()
  const user = (users.list || []).find(u => u && u.id === userId)
  if (!user) return { ok: false }
  const prev = user.avatar || ''
  if (prev) { await removeFile(prev) }
  setUserAvatar(userId, '', 0)
  clearAvatarMeta(userId)
  return { ok: true }
}

export async function ensureUserAvatars() {
  const users = getUsers()
  const list = Array.isArray(users.list) ? users.list : []
  let changed = false
  let fallbackCount = 0
  for (const user of list) {
    if (!user || !user.id) continue
    if (!user.avatar) {
      if (user.avatarUpdatedAt) { user.avatarUpdatedAt = 0; changed = true }
      clearAvatarMeta(user.id)
      continue
    }
    const exists = await fileExists(user.avatar)
    if (exists) {
      if (!withinAvatarDir(user.avatar)) {
        const res = await copyIntoAvatarDir(user.id, user.avatar, { ext: extractExt(user.avatar) })
        if (res.ok && res.path) {
          const prev = user.avatar
          user.avatar = res.path
          user.avatarUpdatedAt = res.lastModified
          changed = true
          writeAvatarMeta(user.id, { uri: res.path, lastModified: res.lastModified })
          if (prev && prev !== res.path) { await removeFile(prev) }
        }
      }
      continue
    }
    let restored = false
    for (const cand of legacyCandidates(user)) {
      if (!cand) continue
      const ok = await fileExists(cand)
      if (!ok) continue
      const res = await copyIntoAvatarDir(user.id, cand, { ext: extractExt(cand) })
      if (res.ok && res.path) {
        user.avatar = res.path
        user.avatarUpdatedAt = res.lastModified
        changed = true
        writeAvatarMeta(user.id, { uri: res.path, lastModified: res.lastModified })
        restored = true
        break
      }
    }
    if (!restored) {
      user.avatar = ''
      user.avatarUpdatedAt = 0
      clearAvatarMeta(user.id)
      fallbackCount += 1
      changed = true
    }
  }
  if (changed) setUsers(users)
  if (fallbackCount > 0) {
    try { uni.setStorageSync(AVATAR_NOTICE_KEY, Date.now()) } catch (_) {}
  }
}

export function consumeAvatarRestoreNotice() {
  try {
    const ts = uni.getStorageSync(AVATAR_NOTICE_KEY)
    if (!ts) return false
    uni.removeStorageSync(AVATAR_NOTICE_KEY)
    return true
  } catch (_) {
    return false
  }
}
