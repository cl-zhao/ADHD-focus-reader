import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, rmSync, writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(__dirname, 'dist')

rmSync(DIST, { recursive: true, force: true })
mkdirSync(DIST, { recursive: true })

const baseConfig = {
  configFile: false,
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
}

// 1. 构建 popup
await build({
  ...baseConfig,
  build: {
    outDir: DIST,
    emptyOutDir: false,
    rollupOptions: {
      input: { popup: resolve(__dirname, 'src/popup/index.html') },
    },
  },
  logLevel: 'warn',
})

// 2. 构建 content script (IIFE)
await build({
  ...baseConfig,
  build: {
    outDir: resolve(DIST, 'content'),
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/content/index.tsx'),
      formats: ['iife'],
      name: 'ADHDReader',
      fileName: () => 'content.js',
    },
    copyPublicDir: false,
  },
  logLevel: 'warn',
})

// 3. 构建 background
await build({
  ...baseConfig,
  build: {
    outDir: resolve(DIST, 'background'),
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/background/index.ts'),
      formats: ['es'],
      fileName: () => 'background.js',
    },
    copyPublicDir: false,
  },
  logLevel: 'warn',
})

// 4. 给content.js注入process polyfill（React需要process.env.NODE_ENV）
const { readFile, writeFile } = await import('fs/promises')
const contentPath = resolve(DIST, 'content/content.js')
let contentCode = await readFile(contentPath, 'utf8')
contentCode = contentCode.replace(
  '(function(){"use strict";',
  '(function(){"use strict";var process={env:{NODE_ENV:"production"}};'
)
await writeFile(contentPath, contentCode)
console.log('Injected process polyfill into content.js')

// 5. 写 manifest — 使用 scripting + activeTab 按需注入，不自动注入
writeFileSync(resolve(DIST, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'ADHD专注阅读器',
  version: '0.1.0',
  description: '面向ADHD用户的中文网页专注阅读器',
  permissions: ['storage', 'activeTab', 'scripting'],
  host_permissions: ['https://openrouter.ai/*'],
  background: {
    service_worker: 'background/background.js',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  commands: {
    _execute_action: {
      suggested_key: { default: 'Alt+R' },
      description: '打开ADHD阅读器',
    },
  },
  web_accessible_resources: [{
    matches: ['<all_urls>'],
    resources: ['content/content.js'],
  }],
}, null, 2))

// 6. 修复popup HTML中的资源路径为相对路径
const htmlPath = resolve(DIST, 'src/popup/index.html')
let html = await readFile(htmlPath, 'utf8')
// 把绝对路径 /assets/ 改为相对路径 ../../assets/
html = html.replace(/src="\/assets\//g, 'src="../../assets/')
html = html.replace(/href="\/assets\//g, 'href="../../assets/')
// 去掉 crossorigin
html = html.replace(/ crossorigin/g, '')
await writeFile(htmlPath, html)

console.log('Build complete!')
