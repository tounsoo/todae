// Playwright's browsers on macOS start from the Mac's own settings, which differ from the Linux defaults CI's
// tests were written against. These launch options give each engine CI's behavior on a Mac, and change nothing
// anywhere else. Every Playwright launch in the repo that needs one goes through here.
//
// - Firefox: Playwright's Firefox exits with "Could not find profile folder" on macOS 27 when it reads the real
//   ~/Library. CFFIXED_USER_HOME points it at an empty home of its own. Playwright still passes its own profile.
// - WebKit: Tab skips buttons unless the Mac has keyboard navigation on (AppleKeyboardUIMode). Linux WebKit,
//   which CI runs, always stops on them. A Cocoa argument turns it on for this browser alone, not the Mac.
// - Chromium with a scrollbar: macOS overlays its scrollbars, so they take no width. Linux's, which CI runs,
//   take 15px. A Cocoa argument asks for classic ones.
//
// Playwright refuses a launch argument that doesn't start with "-", and a Cocoa argument's value is one, so
// scripts/macos-browser.sh adds them and runs the browser Playwright would have run.
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface HostLaunchOptions {
  env?: Record<string, string | undefined>;
  executablePath?: string;
  ignoreDefaultArgs?: string[] | boolean;
  args?: string[];
}

/** The settings scripts/macos-browser.sh passes as Cocoa arguments: `AppleKeyboardUIMode 2` and the like. */
export type CocoaDefaults = Record<string, string | number>;

// __dirname, not import.meta.url: Playwright loads apps/docs/playwright.peek.config.ts, and this file with it, as
// CommonJS, where import.meta is a syntax error. Vite's config loader defines __dirname for each file it bundles.
const wrapper = join(__dirname, 'scripts/macos-browser.sh');

/** Whether this host needs the options below. Tests pass another platform. */
export const isMac = (platform: NodeJS.Platform = process.platform) => platform === 'darwin';

const baseEnv = (options: HostLaunchOptions) => ({ ...process.env, ...options.env });

/** Firefox, with a home of its own on macOS so it starts. */
export function firefoxOnHost(options: HostLaunchOptions = {}, platform: NodeJS.Platform = process.platform): HostLaunchOptions {
  if (!isMac(platform)) return options;
  const home = join(tmpdir(), `todae-firefox-home-${process.getuid?.() ?? 'user'}`);
  mkdirSync(home, { recursive: true });
  return { ...options, env: { ...baseEnv(options), CFFIXED_USER_HOME: home } };
}

/** A browser started through scripts/macos-browser.sh with `defaults` as Cocoa arguments, on macOS only. */
export function withCocoaDefaults(
  executable: string,
  defaults: CocoaDefaults,
  options: HostLaunchOptions = {},
  platform: NodeJS.Platform = process.platform,
): HostLaunchOptions {
  if (!isMac(platform)) return options;
  const cocoa = Object.entries(defaults)
    .map(([key, value]) => `-${key} ${value}`)
    .join(' ');
  return {
    ...options,
    executablePath: wrapper,
    env: { ...baseEnv(options), TODAE_BROWSER: options.executablePath ?? executable, TODAE_COCOA_DEFAULTS: cocoa },
  };
}

/** WebKit that stops on every control on Tab, as Linux WebKit does. `executable` is `webkit.executablePath()`. */
export const webkitOnHost = (executable: string, options: HostLaunchOptions = {}, platform?: NodeJS.Platform) =>
  withCocoaDefaults(executable, { AppleKeyboardUIMode: 2 }, options, platform);

/** Chromium whose scrollbars take width, as Linux Chromium's do. `executable` is `chromium.executablePath()`. */
export const classicScrollbarsOnHost = (executable: string, options: HostLaunchOptions = {}, platform?: NodeJS.Platform) =>
  withCocoaDefaults(executable, { AppleShowScrollBars: 'Always' }, options, platform);
