/**
 * Describes the machine a run happens on. Timings only compare between runs
 * whose `type` matches, so the type names what changes a timing: where it ran,
 * the CPU model and how many cores it had.
 */
import os from 'node:os';
import type { Machine } from './record.ts';

export type MachineFacts = {
  platform: string;
  arch: string;
  cpu: string;
  cpus: number;
  memoryBytes: number;
  env: Record<string, string | undefined>;
};

export function readFacts(): MachineFacts {
  const cpus = os.cpus();
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpu: (cpus[0]?.model ?? 'unknown cpu').replace(/\s+/g, ' ').trim(),
    cpus: cpus.length,
    memoryBytes: os.totalmem(),
    env: process.env,
  };
}

export function describeMachine(facts: MachineFacts = readFacts()): Machine {
  const { env } = facts;
  const ci = env.GITHUB_ACTIONS === 'true';
  // A GitHub-hosted runner names its image, such as ubuntu24, in ImageOS.
  const where = ci ? `github-${env.ImageOS ?? env.RUNNER_OS ?? 'runner'}` : facts.platform;
  const type = env.BENCH_MACHINE?.trim() || `${where} ${facts.arch} ${facts.cpus}cpu ${facts.cpu}`;
  return {
    type,
    os: facts.platform,
    arch: facts.arch,
    cpu: facts.cpu,
    cpus: facts.cpus,
    memoryGB: Math.round(facts.memoryBytes / 1024 ** 3),
    ci,
  };
}
