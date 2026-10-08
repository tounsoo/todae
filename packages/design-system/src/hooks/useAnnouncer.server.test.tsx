// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useAnnouncer } from './useAnnouncer';

describe('useAnnouncer on the server', () => {
  it('renders without a document, and announce does nothing', () => {
    expect(typeof document).toBe('undefined');
    function Page() {
      const announce = useAnnouncer();
      announce('Not on the server');
      return <p>ok</p>;
    }
    expect(renderToString(<Page />)).toBe('<p>ok</p>');
  });
});
