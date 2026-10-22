import { cleanup, render, screen, within } from '@testing-library/react';
import { page, userEvent } from '@vitest/browser/context';
import { afterEach, beforeEach, expect, it } from 'vitest';
import '@tounsoo/todae/todae.css';
import { Providers } from '../Providers';
import { AppShellExample } from './AppShellDemo';

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  cleanup();
  await page.viewport(1280, 800);
});

const navButton = () => screen.getByRole('button', { name: 'Navigation' });
const main = () => screen.getByRole('region', { name: /./ });
const navs = () => screen.queryAllByRole('navigation', { name: 'Main' });

function setup() {
  render(
    <Providers>
      <AppShellExample />
    </Providers>,
  );
}

it('shows the sidebar beside the page on a wide screen, and hides it from the header button', async () => {
  setup();
  expect(navs()).toHaveLength(1);
  expect(navButton()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('separator', { name: 'Resize navigation' })).toBeVisible();
  await userEvent.click(navButton());
  expect(navButton()).toHaveAttribute('aria-expanded', 'false');
  expect(navs()).toHaveLength(0);
  await userEvent.click(navButton());
  expect(navs()).toHaveLength(1);
});

it('moves the nav into a drawer on a narrow screen, and keeps the page mounted', async () => {
  setup();
  const before = main();
  await page.viewport(400, 700);
  await expect.poll(() => navButton().getAttribute('aria-haspopup')).toBe('dialog');
  expect(navs()).toHaveLength(0);
  expect(screen.queryByRole('separator')).toBeNull();
  expect(main()).toBe(before);
  expect(main().getBoundingClientRect().width).toBeGreaterThan(300);
  await page.viewport(1280, 800);
  await expect.poll(() => navs()).toHaveLength(1);
  expect(main()).toBe(before);
});

it('hands focus from a sidebar link to the header button when the window narrows', async () => {
  setup();
  within(navs()[0] as HTMLElement)
    .getByRole('link', { name: 'Team' })
    .focus();
  await page.viewport(400, 700);
  await expect.poll(() => document.activeElement).toBe(navButton());
});

it('sends focus to the new page heading when a drawer link is chosen, and back to the button on Escape', async () => {
  await page.viewport(400, 700);
  setup();
  await userEvent.click(navButton());
  const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
  await userEvent.click(within(drawer).getByRole('link', { name: 'Billing' }));
  await expect.poll(() => document.activeElement).toBe(screen.getByRole('heading', { name: 'Billing' }));
  expect(screen.queryByRole('dialog')).toBeNull();

  await userEvent.click(navButton());
  await screen.findByRole('dialog', { name: 'Navigation' });
  await userEvent.keyboard('{Escape}');
  await expect.poll(() => document.activeElement).toBe(navButton());
});

it('closes the drawer when the window widens, with focus on the header button', async () => {
  await page.viewport(400, 700);
  setup();
  await userEvent.click(navButton());
  await screen.findByRole('dialog', { name: 'Navigation' });
  await page.viewport(1280, 800);
  await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
  await expect.poll(() => document.activeElement).toBe(navButton());
  expect(navs()).toHaveLength(1);
});

it('moves focus into the page from the skip link', async () => {
  setup();
  await userEvent.keyboard('{Tab}');
  const skip = screen.getByRole('link', { name: 'Skip to content' });
  expect(document.activeElement).toBe(skip);
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => document.activeElement).toBe(main());
});

it('moves focus from the handle to the header button when the window narrows', async () => {
  setup();
  screen.getByRole('separator', { name: 'Resize navigation' }).focus();
  await page.viewport(400, 700);
  await expect.poll(() => document.activeElement).toBe(navButton());
});

it('restores the width the sidebar last had when the handle collapsed it', async () => {
  setup();
  const separator = screen.getByRole('separator', { name: 'Resize navigation' });
  separator.focus();
  await userEvent.keyboard('{End}');
  expect(separator).toHaveAttribute('aria-valuenow', '320');
  await userEvent.keyboard('{Enter}');
  expect(navButton()).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(navButton());
  expect(separator).toHaveAttribute('aria-valuenow', '320');
});

it('keeps the drawer open for a modified click, and closes it from the current page link, back to the button', async () => {
  await page.viewport(400, 700);
  setup();
  await userEvent.click(navButton());
  const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
  const home = within(drawer).getByRole('link', { name: 'Home' });
  home.addEventListener('click', (event) => event.preventDefault(), { once: true });
  home.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
  expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
  await userEvent.click(home);
  await expect.poll(() => screen.queryByRole('dialog')).toBeNull();
  await expect.poll(() => document.activeElement).toBe(navButton());
});
