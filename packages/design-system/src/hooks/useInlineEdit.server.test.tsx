// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useInlineEdit } from './useInlineEdit.js';

describe('useInlineEdit on the server', () => {
  it('renders without a document', () => {
    expect(typeof document).toBe('undefined');
    function Name() {
      const edit = useInlineEdit({ value: 'Q3 report', onCommit: () => {} });
      return <button {...edit.getTriggerProps()}>{edit.editing ? 'Editing' : 'Rename'}</button>;
    }
    expect(renderToString(<Name />)).toBe('<button>Rename</button>');
  });
});
