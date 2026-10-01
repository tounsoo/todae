'use client';

import { usePathname } from 'next/navigation';

const GROUPS = [
  {
    id: 'components',
    label: 'Components',
    links: [
      ['/composition', 'Composition'],
      ['/button', 'Button'],
      ['/chip', 'Chip'],
      ['/field', 'Field'],
      ['/label', 'Label'],
      ['/description', 'Description'],
      ['/errormessage', 'ErrorMessage'],
      ['/checkbox', 'Checkbox'],
      ['/radio', 'Radio'],
      ['/switch', 'Switch'],
      ['/dialog', 'Dialog'],
      ['/popover', 'Popover'],
      ['/tooltip', 'Tooltip'],
      ['/optionlist', 'OptionList'],
      ['/bottomsheet', 'BottomSheet'],
      ['/stack', 'Stack'],
      ['/text', 'Text'],
    ],
  },
  {
    id: 'recipes',
    label: 'Recipes',
    links: [
      ['/recipes/chip-list', 'Chip list with overflow'],
      ['/recipes/combobox', 'Combobox'],
    ],
  },
  {
    id: 'foundations',
    label: 'Foundations',
    links: [['/tokens', 'Tokens']],
  },
  {
    id: 'tools',
    label: 'Tools',
    links: [['/playground', 'Playground']],
  },
] as const;

export function SiteNav() {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label="Site">
      {GROUPS.map((group) => (
        <div key={group.id} className="site-nav-group">
          <span id={`nav-${group.id}`} className="site-nav-label">
            {group.label}
          </span>
          <ul aria-labelledby={`nav-${group.id}`}>
            {group.links.map(([href, label]) => (
              <li key={href}>
                <a href={href} aria-current={path === href ? 'page' : undefined}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
