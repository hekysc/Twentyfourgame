export function guessPlatformScene() {
  let platform = 'app-unknown'
  // #ifdef MP-WEIXIN
  platform = 'mp-weixin'
  // #endif
  // #ifdef APP-PLUS
  platform = 'app-android'
  // #endif
  // #ifdef APP-IOS
  platform = 'app-ios'
  // #endif
  // #ifdef APP-HARMONY
  platform = 'app-harmony'
  // #endif
  return platform
}
