import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
// The site installs this shim in Providers; components rendered without Providers, such as the Playground's preview, need it too.
import 'temporal-polyfill/global';

// Unmount after each test, so nothing a test rendered, such as next/link's idle prefetch, runs after jsdom is gone.
afterEach(cleanup);
