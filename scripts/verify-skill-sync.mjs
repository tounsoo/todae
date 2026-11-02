import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The Claude and Cursor verify skills share verify.mjs and features/. Decision 0005 lists what else must match.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cursor = resolve(repo, '.cursor/skills/verify')
const claude = resolve(repo, '.claude/skills/verify')

function sharedFiles(dir) {
  const features = readdirSync(join(dir, 'features')).filter((name) => name.endsWith('.md'))
  return ['verify.mjs', ...features.map((name) => join('features', name))].sort()
}

const cursorFiles = sharedFiles(cursor)
const claudeFiles = sharedFiles(claude)
const problems = []

for (const file of new Set([...cursorFiles, ...claudeFiles])) {
  if (!cursorFiles.includes(file)) problems.push(`${relative(repo, join(claude, file))} has no twin in .cursor/skills/verify`)
  else if (!claudeFiles.includes(file)) problems.push(`${relative(repo, join(cursor, file))} has no twin in .claude/skills/verify`)
  else {
    const fromCursor = readFileSync(join(cursor, file), 'utf8')
    const fromClaude = readFileSync(join(claude, file), 'utf8').replaceAll('.claude/skills/verify/', '.cursor/skills/verify/')
    if (fromCursor !== fromClaude) problems.push(`${file} differs between .cursor/skills/verify and .claude/skills/verify`)
  }
}

if (problems.length > 0) {
  console.error(`verify-skill-sync: ${problems.join('; ')}. Make the same change in both copies, as docs/decisions/0005-verify-procedure.md says.`)
  process.exit(1)
}
console.log(`verify-skill-sync: ${cursorFiles.length} shared files match`)
