import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Decision 0005: the Claude and Cursor verify skills share every file but SKILL.md, and both SKILL.md files keep the same rules.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copies = { cursor: '.cursor/skills/verify', claude: '.claude/skills/verify' }

// Each SKILL.md must name these, so a dropped host, port, width, label, id or check shows up.
const sharedRules = [
  '3321',
  'https://todae.omsoo.design',
  'docs-stable',
  '*.vercel.app',
  'READY',
  'meta.githubCommitSha',
  '--expect-sha',
  '--deployment-sha',
  'source=caller-asserted',
  'x-vercel-trusted-oidc-idp-token',
  'VERCEL_OIDC_TOKEN',
  'VERIFY_URL',
  'prj_EUJCIhRJSkC2BYTOnw5Blfu153Zm',
  'team_8iiNJ83cVoixqY1F3xzd566X',
  '.verify/scratch/server.json',
  'data-appearance',
  '1280',
  '390',
  '`/ko`',
  'SITE_GROUPS',
  'nav.top-links',
  '`Open navigation`',
  '`탐색 메뉴 열기`',
  '`Todae on GitHub`',
  '`GitHub의 Todae`',
  '`{count}개 페이지`',
  'group.links.length',
  '`max-width: 48rem`',
  '.verify/evidence',
  '<locale>-<width>-<slug>.png',
  'report.txt',
  'apps/docs/visual/baselines',
  'run link',
  'run --launch',
  'when a check fails',
]

function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? walk(full, base) : [relative(base, full)]
  })
}

function sharedText(copy, file) {
  return readFileSync(join(repo, copies[copy], file), 'utf8').replaceAll(`${copies[copy]}/`, '<skill-dir>/')
}

const problems = []
for (const dir of Object.values(copies)) {
  if (!existsSync(join(repo, dir, 'SKILL.md'))) problems.push(`${dir}/SKILL.md is missing`)
}

if (problems.length === 0) {
  const files = { cursor: walk(join(repo, copies.cursor)), claude: walk(join(repo, copies.claude)) }
  for (const file of new Set([...files.cursor, ...files.claude])) {
    if (file === 'SKILL.md') continue
    const missing = Object.keys(copies).find((copy) => !files[copy].includes(file))
    if (missing) problems.push(`${copies[missing]}/${file} is missing`)
    else if (sharedText('cursor', file) !== sharedText('claude', file)) problems.push(`${file} differs between the two copies`)
  }
  for (const [copy, dir] of Object.entries(copies)) {
    const skill = readFileSync(join(repo, dir, 'SKILL.md'), 'utf8')
    const lost = sharedRules.filter((rule) => !skill.includes(rule))
    if (lost.length > 0) problems.push(`${copy} SKILL.md no longer names ${lost.join(', ')}`)
  }
}

const manifest = readFileSync(join(repo, '.claude/pstack-files.txt'), 'utf8').split('\n')
if (manifest.includes(copies.claude)) {
  problems.push(`.claude/pstack-files.txt lists ${copies.claude}, so the next update-pstack.sh run deletes the Claude copy. Add verify to the skip list in .claude/update-pstack.sh`)
}

if (problems.length > 0) {
  console.error(`verify-skill-sync: ${problems.join('; ')}. Make the same change in both copies, as docs/decisions/0005-verify-procedure.md says.`)
  process.exit(1)
}
console.log(`verify-skill-sync: ${walk(join(repo, copies.cursor)).length - 1} shared files and ${sharedRules.length} rules match`)
