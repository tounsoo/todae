'use client';

import {
  Badge,
  Button,
  Card,
  categoryTone,
  DensityProvider,
  Menu,
  ScrollArea,
  Stack,
  Text,
  useAnnouncer,
  useFocusHandoff,
  useReorder,
  type UseReorderResult,
} from '@tounsoo/todae';
import { EllipsisVertical, GripVertical } from 'lucide-react';
import { useId, useRef, useState, type RefObject } from 'react';
import styles from './Kanban.module.css';

type Task = { id: string; title: string; label: string };
type Column = { id: string; name: string; tasks: Task[] };
type Move = (fromColumn: number, from: number, toColumn: number, to: number) => void;

function moveTask(columns: readonly Column[], fromColumn: number, from: number, toColumn: number, to: number): Column[] {
  const next = columns.map((column) => ({ ...column, tasks: [...column.tasks] }));
  const [task] = next[fromColumn]!.tasks.splice(from, 1);
  next[toColumn]!.tasks.splice(to, 0, task!);
  return next;
}

function BoardCard({
  task,
  index,
  columnIndex,
  columns,
  reorder,
  move,
  landing,
  landed,
}: {
  task: Task;
  index: number;
  columnIndex: number;
  columns: readonly Column[];
  reorder: UseReorderResult;
  move: Move;
  landing: RefObject<HTMLButtonElement | null>;
  landed: string | null;
}) {
  // A card moved to another column leaves its list while its menu holds
  // focus. Focus goes on to the card's trigger in its new column.
  const handoff = useFocusHandoff({ to: landing });
  const last = columns[columnIndex]!.tasks.length - 1;

  return (
    <li ref={handoff} {...reorder.getItemProps(index)} className={styles.card}>
      <Card.Root>
        {/* As on most boards, the title leads with the menu beside its first line,
            and the label and grip sit under it, so the title gets all the width the menu leaves. */}
        <Stack.Root gap="condensed">
          <Stack.Root direction="row" align="start" gap="condensed">
            <Text.Root style={{ flex: 1, minInlineSize: 0, overflowWrap: 'anywhere' }}>{task.title}</Text.Root>
            <Menu.Root>
              <Menu.Trigger
                ref={task.id === landed ? landing : undefined}
                variant="ghost"
                aria-label={`Move ${task.title}`}
              >
                <Button.Icon>
                  <EllipsisVertical />
                </Button.Icon>
              </Menu.Trigger>
              <Menu.Content>
                <Menu.Item
                  disabled={index === 0}
                  onSelect={() => move(columnIndex, index, columnIndex, index - 1)}
                >
                  Move up
                </Menu.Item>
                <Menu.Item
                  disabled={index === last}
                  onSelect={() => move(columnIndex, index, columnIndex, index + 1)}
                >
                  Move down
                </Menu.Item>
                <Menu.Separator />
                {columns.map((column, target) => (
                  <Menu.Item
                    key={column.id}
                    disabled={target === columnIndex}
                    onSelect={() => move(columnIndex, index, target, column.tasks.length)}
                  >
                    Move to {column.name}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Root>
          </Stack.Root>
          <Stack.Root direction="row" align="center" justify="between" gap="condensed">
            <Badge.Root tone={categoryTone(task.label)}>{task.label}</Badge.Root>
            <span {...reorder.getHandleProps(index)} aria-hidden className={styles.grip}>
              <GripVertical size="1em" />
            </span>
          </Stack.Root>
        </Stack.Root>
      </Card.Root>
    </li>
  );
}

function BoardColumn({
  columnIndex,
  columns,
  move,
  landing,
  landed,
}: {
  columnIndex: number;
  columns: readonly Column[];
  move: Move;
  landing: RefObject<HTMLButtonElement | null>;
  landed: string | null;
}) {
  const column = columns[columnIndex]!;
  const headingId = useId();
  // Each column is its own list to drag in. A card goes to another column
  // through its menu.
  const reorder = useReorder({
    onMove: (from, to) => move(columnIndex, from, columnIndex, to),
  });

  return (
    <section aria-labelledby={headingId} className={styles.column}>
      <Stack.Root direction="row" align="center" justify="between" gap="condensed">
        <Text.Root as="h3" id={headingId}>
          {column.name}
        </Text.Root>
        <Badge.Root>{column.tasks.length}</Badge.Root>
      </Stack.Root>
      {column.tasks.length > 0 ? (
        <ol aria-labelledby={headingId} className={styles.list}>
          {column.tasks.map((task, index) => (
            <BoardCard
              key={task.id}
              task={task}
              index={index}
              columnIndex={columnIndex}
              columns={columns}
              reorder={reorder}
              move={move}
              landing={landing}
              landed={landed}
            />
          ))}
        </ol>
      ) : (
        <Text.Root tone="muted">No tasks</Text.Root>
      )}
    </section>
  );
}

export function KanbanBoard({
  columns,
  onChange,
}: {
  columns: readonly Column[];
  onChange: (columns: Column[]) => void;
}) {
  const announce = useAnnouncer();
  // The trigger of the card that last moved to another column, which takes
  // focus from the card's old element.
  const landing = useRef<HTMLButtonElement | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  const move: Move = (fromColumn, from, toColumn, to) => {
    const task = columns[fromColumn]!.tasks[from]!;
    const next = moveTask(columns, fromColumn, from, toColumn, to);
    if (toColumn !== fromColumn) setLanded(task.id);
    onChange(next);
    const column = next[toColumn]!;
    announce(`${task.title} moved to ${column.name}, position ${to + 1} of ${column.tasks.length}`);
  };

  // Cards on a board are dense, so the board uses the compact density.
  return (
    <DensityProvider density="compact">
      <ScrollArea.Root axis="inline">
        <div className={styles.board}>
          {columns.map((column, columnIndex) => (
            <BoardColumn
              key={column.id}
              columnIndex={columnIndex}
              columns={columns}
              move={move}
              landing={landing}
              landed={landed}
            />
          ))}
        </div>
      </ScrollArea.Root>
    </DensityProvider>
  );
}

const COLUMNS: Column[] = [
  {
    id: 'todo',
    name: 'To do',
    tasks: [
      { id: 'export', title: 'Export invoices as CSV', label: 'Feature' },
      { id: 'chart', title: 'Fix chart colors in dark mode', label: 'Bug' },
      { id: 'guide', title: 'Write the onboarding guide', label: 'Docs' },
    ],
  },
  {
    id: 'doing',
    name: 'In progress',
    tasks: [
      { id: 'search', title: 'Search across projects', label: 'Feature' },
      { id: 'due', title: 'Show due dates in local time', label: 'Bug' },
    ],
  },
  {
    id: 'done',
    name: 'Done',
    tasks: [{ id: 'sso', title: 'Sign in with SSO', label: 'Feature' }],
  },
];

export default function KanbanExample() {
  const [columns, setColumns] = useState(COLUMNS);
  return <KanbanBoard columns={columns} onChange={setColumns} />;
}
