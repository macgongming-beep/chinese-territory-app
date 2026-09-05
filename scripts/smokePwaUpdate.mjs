// Local two-deployment rehearsal using the real registration, SW and update UI.
// No Supabase credentials or production requests are used.
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const repo = process.cwd()
const root = await mkdtemp(join(repo, 'node_modules/.pwa-rehearsal-'))
let server, browser
let served
const modulePath = (name) => JSON.stringify(resolve(repo, name))
async function deployment(version) {
  const dir = join(root, version)
  await mkdir(dir)
  await writeFile(join(dir, 'index.html'), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>')
  await writeFile(join(dir, 'lazy.ts'), `export default ${JSON.stringify(version + '-lazy')}`)
  await writeFile(join(dir, 'main.tsx'), `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {AppUpdateNotice} from ${modulePath('src/components/AppUpdateNotice.tsx')};
    import {AppLoading} from ${modulePath('src/components/AppLoading.tsx')};
    import {checkForUpdate} from ${modulePath('src/lib/pwa.ts')};
    import ${modulePath('src/index.css')}; import ${modulePath('src/App.css')};
    window.checkUpdate=checkForUpdate;
    window.lazyProbe=()=>import('./lazy').then(m=>m.default);
    createRoot(document.getElementById('root')).render(location.search.includes('slow')
      ? <AppLoading kind="screen"/>
      : <main><h1>${version}</h1><input aria-label="draft"/><AppUpdateNotice/></main>);
  `)
  await build({ configFile: false, root: dir, logLevel: 'warn',
    plugins: [react(), VitePWA({ strategies: 'injectManifest', registerType: 'prompt',
      srcDir: resolve(repo, 'src/lib'), filename: 'sw.ts', injectRegister: false,
      manifest: false, injectManifest: { globPatterns: ['**/*.{js,html,css}'] } })],
    build: { outDir: join(dir, 'dist'), emptyOutDir: true },
  })
  return join(dir, 'dist')
}
try {
  const first = await deployment('version-A')
  const second = await deployment('version-B')
  served = first
  server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname
      const file = join(served, path === '/' ? 'index.html' : path)
      const data = await readFile(file)
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html')
      res.end(data)
    } catch { res.writeHead(404); res.end('missing') }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  // Block every external request, including analytics/API calls.
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort())
  const page = await context.newPage()
  await page.goto(origin)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await page.getByRole('textbox').fill('unsaved draft')
  await page.evaluate(() => localStorage.setItem('auth_token', 'sentinel-not-a-real-token'))
  const other = await context.newPage()
  await other.goto(origin)
  await other.getByRole('textbox').fill('second window draft')
  let navigations = 0
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++ })
  served = second
  await page.evaluate(() => window.checkUpdate())
  await other.evaluate(() => window.checkUpdate())
  await page.getByText('새 버전이 준비됐습니다.').waitFor()
  assert.equal(navigations, 0, 'deployment reloaded an open window')
  assert.equal(await page.getByRole('textbox').inputValue(), 'unsaved draft')
  assert.equal(await other.getByRole('textbox').inputValue(), 'second window draft')
  // The old lazy chunk is now 404 at the server; the waiting SW must keep A usable.
  assert.equal(await page.evaluate(() => window.lazyProbe()), 'version-A-lazy')
  await context.setOffline(true)
  assert.equal(await other.evaluate(() => window.lazyProbe()), 'version-A-lazy')
  await context.setOffline(false)
  await page.screenshot({ path: '/tmp/field-map-update-ready.png' })
  await page.getByRole('button', { name: '지금 업데이트' }).click()
  await page.getByRole('heading', { name: 'version-B' }).waitFor()
  await other.getByRole('heading', { name: 'version-B' }).waitFor()
  assert.equal(navigations, 1, 'update must reload once after activation')
  assert.equal(await page.evaluate(() => localStorage.getItem('auth_token')), 'sentinel-not-a-real-token')
  assert.equal(await page.evaluate(() => window.lazyProbe()), 'version-B-lazy')
  await page.goto(origin + '/?slow=1')
  await page.getByRole('button', { name: '앱 다시 불러오기' }).waitFor({ timeout: 16_000 })
  await page.screenshot({ path: '/tmp/field-map-loading-recovery.png' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  console.log('PASS: waiting preserves two drafts and old lazy assets; offline works; explicit update reloads once; login retained; slow-screen recovery visible.')
} finally {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
  await rm(root, { recursive: true, force: true })
}
