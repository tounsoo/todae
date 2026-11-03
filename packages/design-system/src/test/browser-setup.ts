import './temporal.js';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetTooltipWarmth } from '../overlay/tooltipWarmth.js';
import '../styles/todae.css';

afterEach(() => {
  cleanup();
  resetTooltipWarmth();
});
