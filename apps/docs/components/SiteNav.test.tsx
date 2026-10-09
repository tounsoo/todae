// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteNav } from './SiteNav';

vi.mock('next/navigation', () => ({ usePathname: () => '/chip-list' }));

const HREFS = [
  '/guides/build-on-todae',
  '/composition',
  '/tokens',
  '/guides/css-layers',
  '/platform',
  '/alert',
  '/avatar',
  '/badge',
  '/bottomsheet',
  '/breadcrumbs',
  '/button',
  '/card',
  '/checkbox',
  '/chip',
  '/chip-list',
  '/description',
  '/dialog',
  '/drawer',
  '/errormessage',
  '/field',
  '/fieldset',
  '/grid',
  '/label',
  '/menu',
  '/optionlist',
  '/pagination',
  '/popover',
  '/radio',
  '/stack',
  '/switch',
  '/tabs',
  '/text',
  '/toast',
  '/toggle-group',
  '/toolbar',
  '/tooltip',
  '/code',
  '/disclosure',
  '/link',
  '/progress',
  '/separator',
  '/slider',
  '/spinner',
  '/table',
  '/visually-hidden',
  '/utilities/strings-provider',
  '/utilities/use-announcer',
  '/utilities/use-chip-field',
  '/utilities/use-chip-list',
  '/utilities/use-combobox',
  '/utilities/use-controlled-state',
  '/utilities/use-controlled-value',
  '/utilities/use-dropzone',
  '/utilities/use-field',
  '/utilities/use-highlight',
  '/utilities/use-hotkey',
  '/utilities/use-modal-layer',
  '/utilities/use-popover',
  '/utilities/use-roving-focus',
  '/utilities/use-sheet-presentation',
  '/utilities/use-tooltip',
  '/recipes/combobox',
  '/recipes/command-palette',
  '/recipes/file-upload',
  '/playground',
];

describe('SiteNav', () => {
  it('groups the same links under Site', () => {
    render(<SiteNav locale="en" />);
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(screen.getAllByRole('list')).toHaveLength(6);
    for (const name of ['Foundations', 'Components', 'Native elements', 'Utilities', 'Recipes', 'Tools']) {
      expect(screen.getByRole('list', { name })).toBeTruthy();
      expect(screen.getByText(name).tagName).toBe('SPAN');
    }
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe('ChipList');
    expect([...nav.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual(HREFS);
    expect(nav.textContent).not.toContain('Recipes:');
    expect(screen.getByRole('list', { name: 'Foundations' }).getAttribute('aria-labelledby')).toBe('nav-foundations');
    const hrefsIn = (name: string) =>
      [...screen.getByRole('list', { name }).querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefsIn('Components')).not.toContain('/composition');
    expect(hrefsIn('Native elements')).toEqual(['/code', '/disclosure', '/link', '/progress', '/separator', '/slider', '/spinner', '/table', '/visually-hidden']);
    expect(hrefsIn('Foundations')).toEqual(['/guides/build-on-todae', '/composition', '/tokens', '/guides/css-layers', '/platform']);
    expect(hrefsIn('Utilities')).toEqual([
      '/utilities/strings-provider',
      '/utilities/use-announcer',
      '/utilities/use-chip-field',
      '/utilities/use-chip-list',
      '/utilities/use-combobox',
      '/utilities/use-controlled-state',
      '/utilities/use-controlled-value',
      '/utilities/use-dropzone',
      '/utilities/use-field',
      '/utilities/use-highlight',
      '/utilities/use-hotkey',
      '/utilities/use-modal-layer',
      '/utilities/use-popover',
      '/utilities/use-roving-focus',
      '/utilities/use-sheet-presentation',
      '/utilities/use-tooltip',
    ]);
  });

  it('keeps group label ids unique for a second copy', () => {
    const { container } = render(
      <>
        <SiteNav locale="en" />
        <SiteNav locale="en" idPrefix="drawer-nav" />
      </>,
    );
    const ids = [...container.querySelectorAll('.site-nav-label')].map((label) => label.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(ids.length);
    for (const list of container.querySelectorAll('ul[aria-labelledby]')) {
      expect(container.querySelector(`#${list.getAttribute('aria-labelledby')}`)).not.toBeNull();
    }
  });
});
