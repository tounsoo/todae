import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount after each test, so nothing a test rendered, such as next/link's idle prefetch, runs after jsdom is gone.
afterEach(cleanup);
