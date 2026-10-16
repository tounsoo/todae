'use client';

import { Stack, Text, Tree } from '@tounsoo/todae';
import { File, FileCode, FileText, Folder, FolderOpen } from 'lucide-react';
import { useState } from 'react';

type Node = { name: string; children?: Node[] };

const FILES: Node[] = [
  {
    name: 'src',
    children: [
      {
        name: 'components',
        children: [{ name: 'Button.tsx' }, { name: 'Button.module.css' }, { name: 'Tree.tsx' }],
      },
      { name: 'hooks', children: [{ name: 'useRovingFocus.ts' }] },
      { name: 'index.ts' },
    ],
  },
  { name: 'tokens', children: [{ name: 'resolver.json' }] },
  { name: 'package.json' },
  { name: 'README.md' },
];

function FileIcon({ name }: { name: string }) {
  if (/\.(tsx?|css)$/.test(name)) return <FileCode />;
  if (name.endsWith('.md')) return <FileText />;
  return <File />;
}

function Items({ nodes, path, expanded }: { nodes: Node[]; path: string; expanded: string[] }) {
  return nodes.map((node) => {
    const value = `${path}${node.name}`;
    return (
      <Tree.Item key={value} value={value}>
        <Tree.Label>
          <Tree.Icon>
            {node.children ? expanded.includes(value) ? <FolderOpen /> : <Folder /> : <FileIcon name={node.name} />}
          </Tree.Icon>
          {node.name}
        </Tree.Label>
        {node.children ? (
          <Tree.Group>
            <Items nodes={node.children} path={`${value}/`} expanded={expanded} />
          </Tree.Group>
        ) : null}
      </Tree.Item>
    );
  });
}

export function TreeFiles() {
  const [expanded, setExpanded] = useState(['src', 'src/components']);
  const [value, setValue] = useState<string | null>('src/components/Tree.tsx');
  return (
    <Stack.Root>
      <Tree.Root
        aria-label="Files"
        expanded={expanded}
        onExpandedChange={setExpanded}
        value={value}
        onValueChange={setValue}
        style={{ maxInlineSize: '18rem' }}
      >
        <Items nodes={FILES} path="" expanded={expanded} />
      </Tree.Root>
      <Text.Root size="s" tone="muted">
        Selected: {value ?? 'nothing'}
      </Text.Root>
    </Stack.Root>
  );
}
