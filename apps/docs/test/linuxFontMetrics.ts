import { server } from 'vitest/browser';
import { pinLinuxFontMetrics } from '../../../browser.host';

// On macOS, text gets the font metrics of CI's Linux runs. browser.host.ts says why.
pinLinuxFontMetrics(server.platform);
