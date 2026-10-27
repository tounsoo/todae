import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = resolve(repo, 'packages/design-system')
const pkg = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8'))
const budget = JSON.parse(readFileSync(resolve(pkgDir, 'size-budget.json'), 'utf8'))

// Side-effect `import "./file.js"` is walked. A specifier that does not already end in .js is skipped. Dynamic import() is not walked.
const relativeImport = /(?:from\s+|import\s*)["'](\.[^"']+)["']/g

function walkJs(file, seen) {
  const abs = resolve(file)
  if (seen.has(abs)) return
  seen.add(abs)
  const code = readFileSync(abs, 'utf8')
  for (const match of code.matchAll(relativeImport)) {
    const spec = match[1]
    if (!spec.endsWith('.js')) continue
    walkJs(resolve(dirname(abs), spec), seen)
  }
}

const js = new Set()
const css = new Set()
for (const value of Object.values(pkg.exports)) {
  const target = typeof value === 'string' ? value : value.import
  if (!target) continue
  const abs = resolve(pkgDir, target)
  if (abs.endsWith('.css')) css.add(abs)
  else if (abs.endsWith('.js')) walkJs(abs, js)
}

function gzipBytes(files) {
  let total = 0
  for (const file of files) total += gzipSync(readFileSync(file)).length
  return total
}

const measured = { js: gzipBytes(js), css: gzipBytes(css) }
let over = false
for (const key of ['js', 'css']) {
  const size = measured[key]
  const limit = budget[key]
  console.log(`${key} gzip ${size} limit ${limit} files ${key === 'js' ? js.size : css.size}`)
  if (size > limit) over = true
}
if (over) process.exit(1)
