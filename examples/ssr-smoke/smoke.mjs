import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const port = 4173
const cwd = new URL('.', import.meta.url)
const child = spawn('pnpm', ['exec', 'next', 'start', '-p', String(port)], {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
})

let log = ''
child.stdout?.on('data', (chunk) => {
  log += chunk
})
child.stderr?.on('data', (chunk) => {
  log += chunk
})

const markers = ['SSR text', 'SSR button', 'SSR dialog']
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
  if (child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  }
}

const missing = markers.filter((marker) => !html.includes(marker))
if (status !== 200 || missing.length > 0) {
  console.error(`ssr smoke status ${status}`)
  if (missing.length > 0) console.error(`missing ${missing.join(', ')}`)
  console.error(log)
  console.error(html.slice(0, 1500))
  process.exit(1)
}

console.log(`ssr smoke status ${status}`)
for (const marker of markers) console.log(`found ${marker}`)
