// Runtime identity is deliberately not restored automatically: practice never calls the cloud.
let onlineUser = null
export const PRACTICE_ID = 'practice'
export function isOnline() {
  return !!onlineUser
}
export function currentIdentity() {
  return (
    onlineUser || {
      id: PRACTICE_ID,
      name: '本地练习',
      avatar: '',
      color: '#dce9df',
    }
  )
}
export function setOnlineIdentity(user) {
  onlineUser = user ? { ...user } : null
}
export function storageScope() {
  return onlineUser ? `online:${onlineUser.id}` : 'practice'
}
