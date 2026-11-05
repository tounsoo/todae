import './temporal.js';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { resetInputModality } from '../internal/inputModality.js';
import { resetTooltipWarmth } from '../overlay/tooltipWarmth.js';
import { blurBeforeCleanup } from './focus.js';
import '../styles/todae.css';

afterEach(() => {
  blurBeforeCleanup();
  cleanup();
  resetTooltipWarmth();
  resetInputModality();
});

// One page runs every file, and the frame of the file before is removed with focus in it. Firefox can leave this
// frame's window unfocused, so typed keys and the first Tab would go to the top page.
beforeEach(async () => {
  window.focus();
  for (let frame = 0; frame < 10 && !document.hasFocus(); frame++) await new Promise(requestAnimationFrame);
});
