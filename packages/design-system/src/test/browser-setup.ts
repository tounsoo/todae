import './temporal.js';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetTooltipWarmth } from '../components/Tooltip.warmth.js';
import '../styles/todae.css';

afterEach(() => {
  cleanup();
  resetTooltipWarmth();
});
