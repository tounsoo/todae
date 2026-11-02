import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    package: { type: 'string' },
    json: { type: 'string' },
    baseline: { type: 'string' },
    summary: { type: 'string' },
  },
})

const pkgDir = values.package ? resolve(values.package) : resolve(repo, 'packages/design-system')
const EVERYTHING = '. (everything)'
const NODE_DIR = `dist${sep}scripts${sep}`

function fail(message) {
  console.error(`size-check: ${message}`)
  process.exit(1)
}

if (!existsSync(resolve(pkgDir, 'dist'))) {
  fail(`${resolve(pkgDir, 'dist')} is missing. Run \`pnpm build:ds\` first.`)
}

const pkg = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8'))

// Node built-ins are external in every bundle, so a browser entry that imports one still gets a row.
const external = [
  'node:*',
  ...builtinModules,
  ...Object.keys(pkg.peerDependencies ?? {}).flatMap((name) => [name, `${name}/*`]),
]

async function bundleGzip(contents, platform, extra = {}) {
  const result = await build({
    stdin: { contents, resolveDir: pkgDir, loader: 'js' },
    bundle: true,
    minify: true,
    format: 'esm',
    platform,
    write: false,
    logLevel: 'silent',
    outfile: 'out.js',
    external,
    ...extra,
  })
  const js = result.outputFiles.filter((file) => file.path.endsWith('.js'))
  return { gzip: js.reduce((total, file) => total + gzipSync(file.contents).length, 0), result }
}

function describeError(error) {
  const messages = error?.errors?.map((message) => {
    const where = message.location ? ` (${message.location.file}:${message.location.line})` : ''
    return `${message.text}${where}`
  })
  return messages?.length ? messages.join('; ') : String(error?.message ?? error)
}

const entries = []
const cssFiles = new Set()
for (const [key, value] of Object.entries(pkg.exports ?? {})) {
  const target = typeof value === 'string' ? value : value?.import
  if (typeof target !== 'string') continue
  const file = resolve(pkgDir, target)
  if (file.endsWith('.css')) cssFiles.add(file)
  else if (file.endsWith('.js')) {
    entries.push({ key, file, platform: relative(pkgDir, file).startsWith(NODE_DIR) ? 'node' : 'browser' })
  }
}

if (entries.find((entry) => entry.key === './tokens-builder')?.platform !== 'node') {
  fail('./tokens-builder must be an export whose import target is under dist/scripts/. It is the one entry measured as Node code, so update scripts/size-check.mjs if it moved.')
}

const rows = {}
const failures = []

async function measure(label, task) {
  try {
    await task()
  } catch (error) {
    failures.push(`${label}: ${describeError(error)}`)
  }
}

const reexport = (file) => `export * from ${JSON.stringify(file)}`

const root = entries.find((entry) => entry.key === '.')
if (root) {
  await measure('.', async () => {
    const { gzip, result } = await bundleGzip(reexport(root.file), 'browser', { metafile: true })
    rows[EVERYTHING] = { kind: 'entry', platform: 'browser', gzip }
    const names = new Set(Object.values(result.metafile.outputs).flatMap((output) => output.exports ?? []))
    await Promise.all(
      [...names].map((name) =>
        measure(`${name} (export of .)`, async () => {
          const { gzip } = await bundleGzip(`export { ${name} } from ${JSON.stringify(root.file)}`, 'browser')
          rows[name] = { kind: 'export', platform: 'browser', gzip }
        }),
      ),
    )
  })
}

await Promise.all(
  entries
    .filter((entry) => entry.key !== '.')
    .map((entry) =>
      measure(entry.key, async () => {
        const { gzip } = await bundleGzip(reexport(entry.file), entry.platform)
        rows[entry.key] = { kind: 'entry', platform: entry.platform, gzip }
      }),
    ),
)

for (const file of cssFiles) {
  await measure(relative(pkgDir, file), async () => {
    rows[basename(file)] = { kind: 'css', platform: 'browser', gzip: gzipSync(readFileSync(file)).length }
  })
}

if (failures.length) {
  fail(`esbuild could not bundle:\n${failures.map((line) => `  ${line}`).join('\n')}`)
}

const kindOrder = { entry: 0, css: 1, export: 2 }
const names = Object.keys(rows).sort((a, b) => kindOrder[rows[a].kind] - kindOrder[rows[b].kind] || a.localeCompare(b))
const report = { commit: process.env.GITHUB_SHA ?? null, rows: Object.fromEntries(names.map((name) => [name, rows[name]])) }

if (values.json) {
  mkdirSync(dirname(resolve(values.json)), { recursive: true })
  writeFileSync(values.json, `${JSON.stringify(report, null, 2)}\n`)
}

let baseline = null
if (values.baseline) {
  try {
    const parsed = JSON.parse(readFileSync(values.baseline, 'utf8'))
    if (parsed && typeof parsed.rows === 'object' && parsed.rows !== null) baseline = parsed
  } catch {
    baseline = null
  }
}

function change(before, after) {
  if (before === undefined) return { text: 'added', delta: after }
  if (after === undefined) return { text: 'removed', delta: -before }
  const delta = after - before
  const percent = before === 0 ? 0 : (delta / before) * 100
  const sign = delta > 0 ? '+' : ''
  return { text: `${sign}${delta} B (${sign}${percent.toFixed(1)}%)`, delta }
}

const lines = [...new Set([...names, ...Object.keys(baseline?.rows ?? {})])].map((name) => {
  const before = baseline?.rows[name]?.gzip
  const after = rows[name]?.gzip
  return { name, before, after, platform: (rows[name] ?? baseline?.rows[name])?.platform, ...change(before, after) }
})
const changed = lines
  .filter((line) => line.delta !== 0)
  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name))

const width = Math.max(...lines.map((line) => line.name.length), 4)
console.log('Gzip bytes per export after tree-shaking. Sizes never fail this check.')
console.log(`${'name'.padEnd(width)}  ${'platform'.padEnd(8)}  ${'gzip'.padEnd(7)}${baseline ? '  change' : ''}`)
for (const line of lines) {
  const size = line.after === undefined ? 'removed' : String(line.after)
  const delta = baseline ? `  ${line.delta === 0 ? '-' : line.text}` : ''
  console.log(`${line.name.padEnd(width)}  ${String(line.platform).padEnd(8)}  ${size.padEnd(7)}${delta}`)
}
if (!baseline) console.log('No main report to compare with.')

if (values.summary) {
  const cell = (value) => (value === undefined ? '-' : `${value} B`)
  const table = (items) =>
    [
      '| Name | Main | This branch | Change |',
      '| --- | ---: | ---: | --- |',
      ...items.map((line) => `| \`${line.name}\` | ${cell(line.before)} | ${cell(line.after)} | ${line.delta === 0 ? '-' : line.text} |`),
    ].join('\n')
  const parts = ['## Bundle size', '']
  if (baseline) {
    const sha = typeof baseline.commit === 'string' && baseline.commit ? `\`${baseline.commit.slice(0, 7)}\`` : 'an unknown commit'
    parts.push(`Gzip bytes per export after tree-shaking, compared with the main report from ${sha}.`, '')
    parts.push(changed.length ? table(changed) : 'No size changes.', '')
  } else {
    parts.push('Gzip bytes per export after tree-shaking. There was no main report to compare with.', '')
  }
  parts.push('<details>', '<summary>All sizes</summary>', '', table(lines), '', '</details>', '')
  appendFileSync(values.summary, `${parts.join('\n')}\n`)
}
