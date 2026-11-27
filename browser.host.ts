// The browser side of playwright.host.ts: what a browser test page sets so a Mac measures text as CI's Linux does.
//
// CI's browser jobs run in Linux, where todae's sans-serif stack lands on Liberation Sans (ci.yml's "Use a
// sans-serif with a bold face" step). On macOS it lands on SF Pro, whose line box is taller, so checks that
// measure text came out a pixel or two off on a Mac only: EventCalendar's day mark, a Stack's wrapped rows.
// Arial has Liberation Sans's metrics, which is what Liberation Sans was drawn for, and every Mac has it.
// `platform` is Vitest's server.platform, the host's process.platform.
export function pinLinuxFontMetrics(platform: string, root: HTMLElement = document.documentElement): void {
  if (platform === 'darwin') root.style.setProperty('--todae-font-family-sans', 'Arial, sans-serif');
}
