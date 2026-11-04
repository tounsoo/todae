import './temporal.js';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { resetTooltipWarmth } from '../overlay/tooltipWarmth.js';
import '../styles/todae.css';

afterEach(() => {
  cleanup();
  resetTooltipWarmth();
});

// One page runs every file, and the frame of the file before is removed with focus in it. Firefox can leave this
// frame's window unfocused, so typed keys and the first Tab would go to the top page.
beforeEach(async () => {
  window.focus();
  for (let frame = 0; frame < 10 && !document.hasFocus(); frame++) await new Promise(requestAnimationFrame);
});
