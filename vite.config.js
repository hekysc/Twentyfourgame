import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const appPackage = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
)
const buildTime = process.env.TF24_BUILD_TIME || new Date().toISOString()

export default defineConfig({
  plugins: [uni()],
  define: {
    __TF24_APP_VERSION__: JSON.stringify(appPackage.version),
    __TF24_BUILD_TIME__: JSON.stringify(buildTime),
  },
})
