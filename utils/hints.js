import { reactive, onUnmounted } from 'vue'
import { getLastHintTimestamp, setLastHintTimestamp } from './prefs.js'

export function useFloatingHint() {
  const state = reactive({
    visible: false,
    text: '',
    interactive: false,
    id: 0,
  })
  let timer = null
  let lastStamp = 0

  try {
    const persisted = getLastHintTimestamp()
    if (Number.isFinite(persisted)) lastStamp = persisted
  } catch (_) { lastStamp = 0 }

  function hideHint() {
    state.visible = false
    state.text = ''
    state.interactive = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function resolveOptions(durationOrOptions, maybeOptions) {
    if (durationOrOptions && typeof durationOrOptions === 'object') {
      return { ...(durationOrOptions || {}) }
    }
    const base = {}
    if (Number.isFinite(durationOrOptions)) {
      base.duration = durationOrOptions
    }
    if (maybeOptions && typeof maybeOptions === 'object') {
      Object.assign(base, maybeOptions)
    }
    return base
  }

  function showHint(text, durationOrOptions = 1800, maybeOptions = {}) {
    const now = Date.now()
    if (now - lastStamp < 300) {
      return
    }
    lastStamp = now
    try { setLastHintTimestamp(now) } catch (_) {}

    const options = resolveOptions(durationOrOptions, maybeOptions)
    const interactive = options.interactive === undefined ? false : !!options.interactive
    const autoDuration = Number.isFinite(options.duration) ? options.duration : (Number.isFinite(durationOrOptions) ? durationOrOptions : 1800)
    const shouldAutoDismiss = options.autoDismiss === undefined ? !interactive : !!options.autoDismiss

    state.text = typeof text === 'string' ? text : ''
    state.visible = !!state.text
    state.interactive = interactive
    state.id = (state.id || 0) + 1

    if (timer) { clearTimeout(timer); timer = null }
    if (shouldAutoDismiss && autoDuration > 0) {
      timer = setTimeout(() => { hideHint() }, autoDuration)
    }
  }

  onUnmounted(() => {
    if (timer) { clearTimeout(timer); timer = null }
  })

  return { hintState: state, showHint, hideHint }
}
