// Every shell script in the repo runs on bash 3.2, the bash macOS ships, as well as on CI's bash 5.
// CI has only bash 5, so it would never notice a bash 4 feature: the first test reads each script for one.
// The second runs each script's self-test under macOS's /bin/bash when this machine has it.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

// Each bash 4 or newer feature, with the bash 3.2 way to write it.
export const BASH4 = [
  { pattern: /\$\{[#!]?[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?(?:,,?|\^\^?)[^}]*\}/, feature: 'case conversion such as ${name,,}', fix: 'a bracket glob such as *.[pP][nN][gG], or tr' },
  { pattern: /\b(?:declare|local|typeset)\s+-[A-Za-z]*A/, feature: 'an associative array', fix: 'a case statement or two indexed arrays' },
  { pattern: /\b(?:declare|local|typeset)\s+-[A-Za-z]*n\b/, feature: 'a nameref', fix: 'eval or passing the value' },
  { pattern: /(?:^|[;&|(\s])(?:mapfile|readarray)\b/, feature: 'mapfile or readarray', fix: 'a while IFS= read -r loop' },
  { pattern: /\|&/, feature: '|& to pipe stderr', fix: '2>&1 |' },
  { pattern: /&>>/, feature: '&>> to append both streams', fix: '>> file 2>&1' },
  { pattern: /;;&|;&\s*$/, feature: 'a case fall-through', fix: 'a separate case arm' },
  { pattern: /\bshopt\s+-s\s+(?:globstar|lastpipe)\b/, feature: 'globstar or lastpipe', fix: 'find, or a loop that reads from a redirect' },
  { pattern: /\$\{[A-Za-z_][A-Za-z0-9_]*@[QEPAaUuLK]\}/, feature: 'a ${name@op} transformation', fix: 'printf %q or plain expansion' },
  { pattern: /\bcoproc\b/, feature: 'coproc', fix: 'a named pipe' },
  { pattern: /\bwait\s+-n\b/, feature: 'wait -n', fix: 'wait on each pid' },
  { pattern: /\$\{?(?:EPOCHSECONDS|EPOCHREALTIME|BASHPID)\b/, feature: 'a bash 4 or 5 variable', fix: 'date +%s or $$' },
];

// Each line of `text` that uses a bash 4 feature, as `<name>:<line>: <feature>; use <fix>`. Comment lines are skipped.
export function bash4Lines(name, text) {
  const hits = [];
  text.split('\n').forEach((line, index) => {
    if (/^\s*#/.test(line)) return;
    for (const { pattern, feature, fix } of BASH4) {
      if (pattern.test(line)) hits.push(`${name}:${index + 1}: ${feature}, which bash 3.2 lacks; use ${fix}`);
    }
  });
  return hits;
}

function shellScripts() {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  return files.filter((file) => {
    if (file.endsWith('.sh')) return true;
    if (file.includes('.') && !file.endsWith('.bash')) return false;
    try {
      return /^#!.*\b(?:ba)?sh\b/.test(readFileSync(join(root, file), 'utf8').split('\n', 1)[0]);
    } catch {
      return false;
    }
  });
}

test('names the bash 4 lowercasing forbidden-paths.sh once used, with the fix', () => {
  // forbidden-paths.sh before it ran on macOS: line 17 was this.
  assert.deepEqual(bash4Lines('forbidden-paths.sh', 'png_file() {\n\tlocal base="${1##*/}"\n\t[[ "${base,,}" == *.png ]]\n}'), [
    'forbidden-paths.sh:3: case conversion such as ${name,,}, which bash 3.2 lacks; use a bracket glob such as *.[pP][nN][gG], or tr',
  ]);
  for (const line of ['declare -A seen=()', 'mapfile -t lines < f', 'cmd |& tee x', 'echo "${name^^}"', 'local -n ref=$1', 'cmd &>> log']) {
    assert.equal(bash4Lines('x.sh', line).length, 1, line);
  }
  for (const line of ['# ${base,,} is bash 4', 'echo "${1##*/}" "${#hits[@]}" "${hits[@]}"', 'IFS= read -r -d "" path', 'echo "${a:-b}"', 'x=${hit//$\'\\n\'/\\\\n}']) {
    assert.deepEqual(bash4Lines('x.sh', line), [], line);
  }
});

test('no shell script in the repo uses a bash 4 feature', () => {
  const scripts = shellScripts();
  assert.ok(scripts.includes('.github/scripts/forbidden-paths.sh'));
  const hits = scripts.flatMap((file) => bash4Lines(file, readFileSync(join(root, file), 'utf8')));
  assert.deepEqual(hits, [], `shell scripts run on macOS's bash 3.2 too:\n${hits.join('\n')}`);
});

// macOS's /bin/bash is 3.2. On Linux, /bin/bash is CI's own bash, so this runs the self-tests there too.
test("each script's self-test passes under /bin/bash", () => {
  for (const script of ['.github/scripts/forbidden-paths.sh', '.github/scripts/change-class.sh']) {
    const run = spawnSync('/bin/bash', [script, '--self-test'], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, `${script} --self-test under /bin/bash: ${run.stderr}`);
  }
});
