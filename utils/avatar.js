import { getUsers, setUsers, setUserAvatar } from './store.js'
import { writeAvatarMeta, clearAvatarMeta } from './prefs.js'

export const MAX_AVATAR_SIZE = 2 * 1024 * 1024
export const AVATAR_NOTICE_KEY = 'tf24_avatar_restore_notice'

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
