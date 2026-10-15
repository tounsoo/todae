'use client';

import { Nav } from '@omsoo.design/todae';
import { CreditCard, House, Settings, Users } from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';

const SETTINGS = [
  ['#profile', 'Profile'],
  ['#security', 'Security'],
  ['#notifications', 'Notifications'],
] as const;

/** An app's side nav. The links stay on this page: a click marks one current, as a router would. */
export function NavApp() {
  const [current, setCurrent] = useState('#security');
  const link = (href: string, children: ReactNode) => (
    <Nav.Link
      href={href}
      aria-current={current === href ? 'page' : undefined}
      onClick={(event: MouseEvent) => {
        event.preventDefault();
        setCurrent(href);
      }}
    >
      {children}
    </Nav.Link>
  );
  return (
    <Nav.Root aria-label="App" style={{ inlineSize: '15rem' }}>
      <Nav.Group>
        <Nav.Item>
          {link(
            '#home',
            <>
              <House aria-hidden="true" />
              Home
            </>,
          )}
        </Nav.Item>
        <Nav.Item>
          {link(
            '#team',
            <>
              <Users aria-hidden="true" />
              Team
            </>,
          )}
        </Nav.Item>
      </Nav.Group>
      <Nav.Group label="Workspace">
        <Nav.Item>
          {link(
            '#billing',
            <>
              <CreditCard aria-hidden="true" />
              Billing
            </>,
          )}
        </Nav.Item>
        <Nav.Item>
          {link(
            '#settings',
            <>
              <Settings aria-hidden="true" />
              Settings
            </>,
          )}
          <Nav.Branch label="Settings pages" open>
            {SETTINGS.map(([href, label]) => (
              <Nav.Item key={href}>{link(href, label)}</Nav.Item>
            ))}
          </Nav.Branch>
        </Nav.Item>
        <Nav.Item>
          <Nav.Branch label="Reports">
            <Nav.Item>{link('#usage', 'Usage')}</Nav.Item>
            <Nav.Item>{link('#invoices', 'Invoices')}</Nav.Item>
          </Nav.Branch>
        </Nav.Item>
      </Nav.Group>
    </Nav.Root>
  );
}
