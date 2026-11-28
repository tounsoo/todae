import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { zipFiles } from './zip';

/** Reads a stored ZIP back through its central directory. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const out: Record<string, string> = {};
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    expect(view.getUint16(local + 8, true)).toBe(0);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    out[name] = decoder.decode(data);
    at += 46 + nameLength;
  }
  return out;
}

describe('zipFiles', () => {
  it('stores each file under its path, with a matching CRC', () => {
    const files = { 'tokens/resolver.json': '{\n  "name": "acme"\n}\n', 'tokens/README.md': '# Acme — 토큰\n', 'empty.txt': '' };
    expect(unzip(zipFiles(files))).toEqual(files);
  });

  it('writes the same bytes for the same files', () => {
    expect(zipFiles({ a: 'x' })).toEqual(zipFiles({ a: 'x' }));
  });
});
