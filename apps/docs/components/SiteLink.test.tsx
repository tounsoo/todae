// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteLink } from './SiteLink';

const nextLink = vi.hoisted(() => ({ hrefs: [] as string[] }));
vi.mock('next/link', async (importOriginal) => {
  const { default: NextLink } = await importOriginal<typeof import('next/link')>();
  return {
    default: (props: Parameters<typeof NextLink>[0]) => {
      nextLink.hrefs.push(String(props.href));
      return <NextLink {...props} />;
    },
  };
});

describe('SiteLink', () => {
  it('moves within the site through next/link and leaves other links plain', () => {
    const ref = { current: null as HTMLAnchorElement | null };
    render(
      <>
        <SiteLink ref={ref} href="/tokens" aria-current="page" className="own">
          Tokens
        </SiteLink>
        <SiteLink href="https://github.com/tounsoo/todae">GitHub</SiteLink>
        <SiteLink href="//example.com">Protocol-relative</SiteLink>
        <SiteLink href="#props">Props</SiteLink>
        <SiteLink>No href</SiteLink>
      </>,
    );
    expect(nextLink.hrefs).toEqual(['/tokens']);
    const tokens = screen.getByRole('link', { name: 'Tokens' });
    expect(ref.current).toBe(tokens);
    expect(tokens.getAttribute('href')).toBe('/tokens');
    expect(tokens.getAttribute('aria-current')).toBe('page');
    expect(tokens.className).toMatch(/own/);
    expect(tokens.className).not.toBe('own');
    expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('href')).toBe('https://github.com/tounsoo/todae');
    expect(screen.getByRole('link', { name: 'Props' }).getAttribute('href')).toBe('#props');
    const bare = screen.getByText('No href');
    expect(bare.tagName).toBe('A');
    expect(bare.hasAttribute('href')).toBe(false);
  });
});
