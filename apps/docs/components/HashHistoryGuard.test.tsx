// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HashHistoryGuard } from './HashHistoryGuard';

const path = vi.hoisted(() => ({ current: '/link' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

describe('HashHistoryGuard', () => {
  it('loads in full only when Back lands on another page through an entry Next did not add', () => {
    const reload = vi.fn();
    const back = (url: string, state: unknown) => {
      window.history.replaceState(state, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state }));
    };
    path.current = '/link';
    render(<HashHistoryGuard reload={reload} />);
    // An entry Next added: Next renders that page itself.
    back('/tokens', { __NA: true });
    expect(reload).not.toHaveBeenCalled();
    // A hash link's entry on the page already shown: the page is right as it is.
    back('/link#billing', null);
    expect(reload).not.toHaveBeenCalled();
    // A hash link's entry on another page, such as /tokens#content after moving on to /link.
    back('/tokens#content', null);
    expect(reload).toHaveBeenCalledTimes(1);
    window.history.replaceState(null, '', '/');
  });
});
