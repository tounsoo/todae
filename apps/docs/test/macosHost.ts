import { beforeEach } from 'vitest';
import { server } from 'vitest/browser';
import { skipOnMacosHost } from '../../../browser.host';

// On macOS, a test that browser.host.ts lists as failing there because of macOS itself is skipped, with why.
// CI's Linux runs it.
beforeEach((context) => skipOnMacosHost(context, server));
