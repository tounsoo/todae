// Installs the packed @tounsoo/todae tarball the way an app gets it from npm,
// resolves every export and loads each module entry with import() and require(), then builds
// this Next.js app against it and fetches the server-rendered page.
// Run `pnpm build:ds` first; the pack skips the prepack build.
import { execFileSync, spawn } from 'node:child_process'
import { lstatSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const pkgDir = join(here, '../../packages/design-system')
const installed = join(here, 'node_modules/@tounsoo/todae')
const port = 4173
const markers = ['Server text', 'Server badge', 'SSR text', 'SSR button', 'SSR dialog']

const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'inherit' })

// The workspace link pnpm makes, put back after the run, or before it when an
// interrupted run left the unpacked tarball in its place.
const link = relative(dirname(installed), pkgDir)
const restoreLink = () => {
  if (lstatSync(installed, { throwIfNoEntry: false })?.isSymbolicLink()) return
  rmSync(installed, { recursive: true, force: true })
  symlinkSync(link, installed)
}
restoreLink()

const temp = mkdtempSync(join(tmpdir(), 'todae-ssr-smoke-'))
let swapped = false
let server
const stopServer = () => {
  if (!server?.pid) return
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    server.kill('SIGTERM')
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopServer()
    if (swapped) restoreLink()
    rmSync(temp, { recursive: true, force: true })
    process.exit(130)
  })
}

try {
  run('pnpm', ['--dir', pkgDir, 'pack', '--pack-destination', temp, '--config.ignore-scripts=true'])
  const tarballs = readdirSync(temp).filter((file) => file.endsWith('.tgz'))
  if (tarballs.length !== 1) throw new Error(`expected one tarball, found ${tarballs.length}`)
  run('tar', ['-xzf', join(temp, tarballs[0]), '-C', temp])

  // Swap the workspace link for the unpacked tarball, so nothing outside the
  // published files can be resolved, and React comes from this app.
  rmSync(installed)
  swapped = true
  renameSync(join(temp, 'package'), installed)

  await checkExports()
  rmSync(join(here, '.next'), { recursive: true, force: true })
  run('pnpm', ['exec', 'next', 'build'], here)
  await fetchPage()
} finally {
  if (swapped) restoreLink()
  rmSync(temp, { recursive: true, force: true })
}

async function checkExports() {
  const { exports } = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
  const require = createRequire(join(here, 'smoke.mjs'))
  let modules = 0
  for (const [key, entry] of Object.entries(exports)) {
    const specifier = key === '.' ? '@tounsoo/todae' : `@tounsoo/todae${key.slice(1)}`
    const file = require.resolve(specifier)
    if (typeof entry !== 'object') continue
    // Each module entry must load both ways: import(), and Node's require() of ESM.
    await import(pathToFileURL(file).href)
    require(specifier)
    modules++
  }
  console.log(`resolved ${Object.keys(exports).length} exports; loaded ${modules} module entries with import() and require()`)
}

async function fetchPage() {
  const child = (server = spawn('pnpm', ['exec', 'next', 'start', '-p', String(port)], {
    cwd: here,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  }))

  let log = ''
  child.stdout?.on('data', (chunk) => {
    log += chunk
  })
  child.stderr?.on('data', (chunk) => {
    log += chunk
  })

  const url = `http://127.0.0.1:${port}/`
  let html = ''
  let status = 0

  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      await delay(200)
      try {
        const response = await fetch(url)
        status = response.status
        html = await response.text()
        break
      } catch {
        html = ''
      }
    }
  } finally {
    stopServer()
  }

  const missing = markers.filter((marker) => !html.includes(marker))
  if (status !== 200 || missing.length > 0) {
    console.error(`ssr smoke status ${status}`)
    if (missing.length > 0) console.error(`missing ${missing.join(', ')}`)
    console.error(log)
    console.error(html.slice(0, 1500))
    process.exitCode = 1
    return
  }

  console.log(`ssr smoke status ${status}`)
  for (const marker of markers) console.log(`found ${marker}`)
}
