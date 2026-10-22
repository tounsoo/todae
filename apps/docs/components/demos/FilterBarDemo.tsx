'use client';

import {
  Badge,
  Button,
  ChipList,
  EmptyState,
  Menu,
  ScrollArea,
  Stack,
  Table,
  Text,
  Toolbar,
  useAnnouncer,
  useFocusHandoff,
  VisuallyHidden,
  type BadgeTone,
} from '@tounsoo/todae';
import { ListFilter } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Todae ships no icons. These come from Lucide; any icon library works.

type Status = 'Open' | 'In progress' | 'Closed';
type Priority = 'High' | 'Medium' | 'Low';
type Issue = { id: number; title: string; status: Status; priority: Priority; assignee: string };

const ISSUES: Issue[] = [
  { id: 101, title: 'Sign-in button overlaps on small screens', status: 'Open', priority: 'High', assignee: 'Mina' },
  { id: 102, title: 'Export drops the last row', status: 'In progress', priority: 'High', assignee: 'Jun' },
  { id: 103, title: 'Typo in the billing email', status: 'Closed', priority: 'Low', assignee: 'Sara' },
  { id: 104, title: 'Dark mode chart colors', status: 'Open', priority: 'Medium', assignee: 'Jun' },
  { id: 105, title: 'Slow search on large teams', status: 'In progress', priority: 'Medium', assignee: 'Mina' },
  { id: 106, title: 'Invite link expires early', status: 'Open', priority: 'High', assignee: 'Sara' },
  { id: 107, title: 'Avatar upload fails for HEIC', status: 'Closed', priority: 'Medium', assignee: 'Mina' },
  { id: 108, title: 'Keyboard trap in date picker', status: 'Open', priority: 'Low', assignee: 'Jun' },
];

// Each facet filters one field. Values in a facet are either-or; facets narrow each other.
const FACETS = [
  { key: 'status', label: 'Status', options: ['Open', 'In progress', 'Closed'] },
  { key: 'priority', label: 'Priority', options: ['High', 'Medium', 'Low'] },
  { key: 'assignee', label: 'Assignee', options: ['Jun', 'Mina', 'Sara'] },
] as const;

type FacetKey = (typeof FACETS)[number]['key'];
type Filters = Record<FacetKey, readonly string[]>;

const NONE: Filters = { status: [], priority: [], assignee: [] };
const TONES: Record<Status, BadgeTone> = { Open: 'info', 'In progress': 'warning', Closed: 'neutral' };
const issues = (count: number) => `${count} ${count === 1 ? 'issue' : 'issues'}`;

export function FilterBarIssues() {
  const announce = useAnnouncer();
  const firstFilter = useRef<HTMLButtonElement>(null);
  const [filters, setFilters] = useState<Filters>(NONE);

  const matches = ISSUES.filter((issue) =>
    FACETS.every(({ key }) => filters[key].length === 0 || filters[key].includes(issue[key])),
  );

  // One chip per chosen value, in the order of the menus.
  const active = FACETS.flatMap(({ key, label }) => filters[key].map((value) => ({ key, label, value })));

  const toggle = (key: FacetKey, value: string, on: boolean) =>
    setFilters((current) => ({
      ...current,
      [key]: on ? [...current[key], value] : current[key].filter((v) => v !== value),
    }));

  // The row of chips and Clear all go away with the last filter, and the empty
  // state's button goes away once something matches. Focus that was on them
  // moves to the first filter button.
  const chipsHandoff = useFocusHandoff({ to: firstFilter });
  const emptyHandoff = useFocusHandoff({ to: firstFilter });

  // Announce the number of matches once the person stops changing filters.
  // A menu stays open while they check several, so each check doesn't speak.
  const key = JSON.stringify(filters);
  const announced = useRef(key);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (announced.current === key) return;
      announced.current = key;
      announce(matches.length === 0 ? 'No issues match these filters' : `${issues(matches.length)} shown`);
    }, 500);
    return () => clearTimeout(timer);
  }, [key, matches.length, announce]);

  return (
    <Stack.Root style={{ inlineSize: '100%' }}>
      <Toolbar.Root aria-label="Filter issues">
        {FACETS.map(({ key, label, options }, index) => {
          const count = filters[key].length;
          return (
            <Menu.Root key={key}>
              <Menu.Trigger ref={index === 0 ? firstFilter : undefined} variant="secondary">
                {index === 0 && (
                  <Button.Icon>
                    <ListFilter />
                  </Button.Icon>
                )}
                {label}
                {count > 0 && (
                  <Badge.Root>
                    {count}
                    <VisuallyHidden.Root> selected</VisuallyHidden.Root>
                  </Badge.Root>
                )}
              </Menu.Trigger>
              <Menu.Content aria-label={label}>
                {options.map((option) => (
                  <Menu.CheckboxItem
                    key={option}
                    checked={filters[key].includes(option)}
                    onCheckedChange={(on) => toggle(key, option, on)}
                  >
                    {option}
                  </Menu.CheckboxItem>
                ))}
              </Menu.Content>
            </Menu.Root>
          );
        })}
      </Toolbar.Root>
      {active.length > 0 && (
        <Stack.Root ref={chipsHandoff} direction="row" align="center" gap="condensed" wrap>
          <ChipList.Root
            aria-label="Active filters"
            chips={active.map(({ label, value }) => `${label}: ${value}`)}
            getKey={(_, index) => `${active[index]!.key}:${active[index]!.value}`}
            onRemove={(index) => {
              const chip = active[index]!;
              toggle(chip.key, chip.value, false);
            }}
          />
          <Button.Root variant="ghost" onClick={() => setFilters(NONE)}>
            Clear all
          </Button.Root>
        </Stack.Root>
      )}
      <Text.Root tone="muted">{`${matches.length} of ${issues(ISSUES.length)}`}</Text.Root>
      <ScrollArea.Root axis="inline" focusable aria-label="Issues table">
        <Table.Root>
          <Table.Caption>Issues</Table.Caption>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell scope="col">Issue</Table.HeaderCell>
              <Table.HeaderCell scope="col">Title</Table.HeaderCell>
              <Table.HeaderCell scope="col">Status</Table.HeaderCell>
              <Table.HeaderCell scope="col">Priority</Table.HeaderCell>
              <Table.HeaderCell scope="col">Assignee</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {matches.map((issue) => (
              <Table.Row key={issue.id}>
                <Table.HeaderCell scope="row">{`#${issue.id}`}</Table.HeaderCell>
                <Table.Cell>{issue.title}</Table.Cell>
                <Table.Cell>
                  <Badge.Root tone={TONES[issue.status]}>{issue.status}</Badge.Root>
                </Table.Cell>
                <Table.Cell>{issue.priority}</Table.Cell>
                <Table.Cell>{issue.assignee}</Table.Cell>
              </Table.Row>
            ))}
            {matches.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <EmptyState.Root>
                    <EmptyState.Title as="h3">No issues match these filters</EmptyState.Title>
                    <EmptyState.Description>Remove a filter or clear them all.</EmptyState.Description>
                    <EmptyState.Actions ref={emptyHandoff}>
                      <Button.Root variant="secondary" onClick={() => setFilters(NONE)}>
                        Clear filters
                      </Button.Root>
                    </EmptyState.Actions>
                  </EmptyState.Root>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </ScrollArea.Root>
    </Stack.Root>
  );
}
