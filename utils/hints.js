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

  function showHint(text, duration = 1800, options = {}) {
    const now = Date.now()
    if (now - lastStamp < 300) {
      return
    }
    lastStamp = now
    try { setLastHintTimestamp(now) } catch (_) {}

    state.text = typeof text === 'string' ? text : ''
    state.visible = !!state.text
    state.interactive = !!options.interactive
    state.id = (state.id || 0) + 1

    if (timer) { clearTimeout(timer); timer = null }
    const autoDuration = Number.isFinite(options.duration) ? options.duration : duration
    if (!state.interactive && autoDuration > 0) {
      timer = setTimeout(() => { hideHint() }, autoDuration)
    }
  }

  onUnmounted(() => {
    if (timer) { clearTimeout(timer); timer = null }
  })

  return { hintState: state, showHint, hideHint }
}
