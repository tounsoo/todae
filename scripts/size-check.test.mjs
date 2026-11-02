import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'size-check.mjs')
const temp = mkdtempSync(join(tmpdir(), 'size-check-'))
after(() => rmSync(temp, { recursive: true, force: true }))

let count = 0
function fixture(files) {
  const dir = join(temp, `pkg-${count++}`)
  const all = {
    'package.json': JSON.stringify({
      name: 'fixture',
      type: 'module',
      sideEffects: ['*.css'],
      peerDependencies: { react: '^19.0.0' },
      exports: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        './stack': { import: './dist/stack.js' },
        './todae.css': './dist/todae.css',
        './dist/todae.css': './dist/todae.css',
        './tokens.json': './tokens.json',
        './tokens-builder': { import: './dist/scripts/build-tokens.js' },
      },
    }),
    'dist/index.js': "export const Alpha = () => 'alpha'\nexport const Beta = () => 'beta'.repeat(50)\n",
    'dist/stack.js': "export const Stack = () => 'stack'\n",
    'dist/todae.css': '.a { color: red; }\n',
    'dist/scripts/build-tokens.js': "import { readFileSync } from 'node:fs'\nexport const build = (file) => readFileSync(file, 'utf8')\n",
    'tokens.json': '{}',
    ...files,
  }
  for (const [name, content] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), content)
  }
  return dir
}

function run(dir, ...args) {
  const result = spawnSync(process.execPath, [script, '--package', dir, ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_SHA: 'abcdef1234567890' } })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function readReport(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

test('a clean package exits 0 and writes a row for every export, entry and css file', () => {
  const dir = fixture({})
  const json = join(temp, 'clean.json')
  const result = run(dir, '--json', json)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Alpha/)
  const report = readReport(json)
  assert.equal(report.commit, 'abcdef1234567890')
  const kinds = Object.fromEntries(Object.entries(report.rows).map(([id, row]) => [id, `${row.kind}/${row.platform}`]))
  assert.deepEqual(kinds, {
    '. (everything)': 'entry/browser',
    './stack': 'entry/browser',
    './tokens-builder': 'entry/node',
    'todae.css': 'css/browser',
    Alpha: 'export/browser',
    Beta: 'export/browser',
  })
  assert.ok(report.rows.Alpha.gzip < report.rows['. (everything)'].gzip)
})

test('--json creates the folder it writes into', () => {
  const json = join(temp, 'new-folder', 'nested', 'report.json')
  const result = run(fixture({}), '--json', json)
  assert.equal(result.status, 0, result.stderr)
  assert.ok(readReport(json).rows.Alpha)
})

test('a bare -- argument is ignored', () => {
  const result = run(fixture({}), '--', '--json', join(temp, 'dashes.json'))
  assert.equal(result.status, 0, result.stderr)
  assert.ok(readReport(join(temp, 'dashes.json')).rows.Alpha)
})

test('a browser entry that imports a Node built-in still exits 0 and gets a row', () => {
  const dir = fixture({
    'dist/stack.js': "import { readFileSync } from 'node:fs'\nimport { join } from 'path'\nexport const Stack = () => readFileSync(join('a', 'b'))\n",
  })
  const json = join(temp, 'builtin.json')
  const result = run(dir, '--json', json)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(readReport(json).rows['./stack'].platform, 'browser')
})

test('a missing dist exits 1 and says to build', () => {
  const dir = fixture({})
  rmSync(join(dir, 'dist'), { recursive: true })
  const result = run(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /pnpm build:ds/)
})

test('a bundle that fails for another reason exits 1 and names the entry and the error', () => {
  const dir = fixture({ 'dist/stack.js': "import './missing.js'\nexport const Stack = 1\n" })
  const result = run(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /\.\/stack/)
  assert.match(result.stderr, /missing\.js/)
})

test('a tokens-builder entry that leaves dist/scripts exits 1', () => {
  const dir = fixture({})
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  pkg.exports['./tokens-builder'] = { import: './dist/stack.js' }
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
  const result = run(dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /tokens-builder/)
})

test('the summary lists changed rows against a baseline and names the baseline commit', () => {
  const dir = fixture({})
  const current = join(temp, 'current.json')
  assert.equal(run(dir, '--json', current).status, 0)
  const report = readReport(current)
  const baseline = structuredClone(report)
  baseline.commit = '1234567890abcdef'
  baseline.rows.Alpha.gzip -= 100
  baseline.rows.Gone = { kind: 'export', platform: 'browser', gzip: 50 }
  delete baseline.rows.Beta
  const baselineFile = join(temp, 'baseline.json')
  writeFileSync(baselineFile, JSON.stringify(baseline))
  const summary = join(temp, 'changed.md')
  const result = run(dir, '--baseline', baselineFile, '--summary', summary)
  assert.equal(result.status, 0, result.stderr)
  const text = readFileSync(summary, 'utf8')
  assert.match(text, /^## Bundle size$/m)
  assert.match(text, /`1234567`/)
  assert.match(text, new RegExp(`\\| \`Alpha\` \\| ${baseline.rows.Alpha.gzip} B \\| ${report.rows.Alpha.gzip} B \\| \\+100 B \\(\\+`))
  assert.match(text, /\| `Beta` \| - \| \d+ B \| added \|/)
  assert.match(text, /\| `Gone` \| 50 B \| - \| removed \|/)
  assert.doesNotMatch(text, /No size changes\./)
  assert.match(text, /<details>/)
})

test('an identical baseline says there are no size changes', () => {
  const dir = fixture({})
  const current = join(temp, 'same.json')
  assert.equal(run(dir, '--json', current).status, 0)
  const summary = join(temp, 'same.md')
  const result = run(dir, '--baseline', current, '--summary', summary)
  assert.equal(result.status, 0, result.stderr)
  const text = readFileSync(summary, 'utf8')
  assert.match(text, /No size changes\./)
  assert.match(text, /<details>[\s\S]*Alpha[\s\S]*<\/details>/)
})

test('a missing baseline is not an error', () => {
  const dir = fixture({})
  const summary = join(temp, 'none.md')
  const result = run(dir, '--baseline', join(temp, 'nope.json'), '--summary', summary)
  assert.equal(result.status, 0, result.stderr)
  assert.match(readFileSync(summary, 'utf8'), /no main report to compare with/)
})
