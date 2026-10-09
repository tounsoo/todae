// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteNav } from './SiteNav';

vi.mock('next/navigation', () => ({ usePathname: () => '/chip-list' }));

const HREFS = [
  '/button',
  '/chip',
  '/chip-list',
  '/field',
  '/label',
  '/description',
  '/errormessage',
  '/fieldset',
  '/checkbox',
  '/radio',
  '/switch',
  '/dialog',
  '/drawer',
  '/popover',
  '/menu',
  '/tooltip',
  '/tabs',
  '/toolbar',
  '/toggle-group',
  '/optionlist',
  '/bottomsheet',
  '/alert',
  '/badge',
  '/card',
  '/breadcrumbs',
  '/pagination',
  '/toast',
  '/avatar',
  '/stack',
  '/grid',
  '/text',
  '/link',
  '/disclosure',
  '/visually-hidden',
  '/separator',
  '/table',
  '/progress',
  '/slider',
  '/spinner',
  '/code',
  '/utilities/use-announcer',
  '/utilities/use-chip-field',
  '/utilities/use-chip-list',
  '/utilities/use-combobox',
  '/utilities/use-controlled-state',
  '/utilities/use-controlled-value',
  '/utilities/use-dropzone',
  '/utilities/use-field',
  '/utilities/use-highlight',
  '/utilities/use-modal-layer',
  '/utilities/use-popover',
  '/utilities/use-roving-focus',
  '/utilities/use-sheet-presentation',
  '/utilities/use-tooltip',
  '/recipes/combobox',
  '/recipes/file-upload',
  '/composition',
  '/tokens',
  '/guides/build-on-todae',
  '/guides/css-layers',
  '/platform',
  '/playground',
];

describe('SiteNav', () => {
  it('groups the same links under Site', () => {
    render(<SiteNav locale="en" />);
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(screen.getAllByRole('list')).toHaveLength(5);
    for (const name of ['Components', 'Utilities', 'Recipes', 'Foundations', 'Tools']) {
      expect(screen.getByRole('list', { name })).toBeTruthy();
      expect(screen.getByText(name).tagName).toBe('SPAN');
    }
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe('ChipList');
    expect([...nav.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual(HREFS);
    expect(nav.textContent).not.toContain('Recipes:');
    const hrefsIn = (name: string) =>
      [...screen.getByRole('list', { name }).querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefsIn('Components')).not.toContain('/composition');
    expect(hrefsIn('Foundations')).toEqual(['/composition', '/tokens', '/guides/build-on-todae', '/guides/css-layers', '/platform']);
    expect(hrefsIn('Utilities')).toEqual([
      '/utilities/use-announcer',
      '/utilities/use-chip-field',
      '/utilities/use-chip-list',
      '/utilities/use-combobox',
      '/utilities/use-controlled-state',
      '/utilities/use-controlled-value',
      '/utilities/use-dropzone',
      '/utilities/use-field',
      '/utilities/use-highlight',
      '/utilities/use-modal-layer',
      '/utilities/use-popover',
      '/utilities/use-roving-focus',
      '/utilities/use-sheet-presentation',
      '/utilities/use-tooltip',
    ]);
  });
});
