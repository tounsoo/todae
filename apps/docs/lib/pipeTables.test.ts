import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codeBlocks } from './mdxAst';

const APP = join(process.cwd(), 'app');

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === 'page.mdx' ? [path] : [];
  });
}

function gfmDelimiterRow(line: string): boolean {
  const trimmed = line.replace(/^ {0,3}/, '').replace(/\s+$/, '');
  if (!trimmed.includes('|')) return false;
  const body = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = body.split('|');
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function delimiterLines(mdx: string): string[] {
  return codeBlocks(mdx).rest.split('\n').filter(gfmDelimiterRow);
}

describe('docs tables', () => {
  it('tells a GFM delimiter row from other lines', () => {
    const rows = [
      '| --- | --- |',
      '|---|---|',
      '| :--- | ---: |',
      '| :---: | :---: |',
      '| ---- | ---- |',
      '--- | ---',
      ' | --- | --- |',
      '| --- | --- | --- |',
    ];
    expect(rows.filter((row) => !gfmDelimiterRow(row))).toEqual([]);
    const notRows = ['---', 'Key | value', '| Key | Mention |', '| -- | -- |', '| :-: |', '    | --- | --- |'];
    expect(notRows.filter(gfmDelimiterRow)).toEqual([]);
  });

  it('ignores a delimiter row inside a code fence', () => {
    expect(delimiterLines('```md\n| --- | --- |\n| a | b |\n```\n\nNo table.\n')).toEqual([]);
    expect(delimiterLines('Before.\n\n| --- | --- |\n')).toEqual(['| --- | --- |']);
  });

  it('are JSX, so a pipe table is not left as text', () => {
    const hits = pages(APP).flatMap((path) =>
      delimiterLines(readFileSync(path, 'utf8')).map((line) => `${relative(APP, path).split(sep).join('/')}: ${line.trim()}`),
    );
    expect(hits).toEqual([]);
  });
});
