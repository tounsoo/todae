import { beforeEach } from 'vitest';
import { server } from 'vitest/browser';
import { macosEntry } from '../../../browser.host';

// On macOS, a test that browser.host.ts lists as failing there because of macOS itself is skipped, with why.
// CI's Linux runs it.
beforeEach((context) => {
  const entry = macosEntry(server.platform, server.browser, context.task.file.filepath, context.task.fullTestName);
  if (entry) context.skip(`macOS host: ${entry.reason}`);
});
