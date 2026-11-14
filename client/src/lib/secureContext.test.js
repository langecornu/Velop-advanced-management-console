// The page is normally opened over plain http from another device, where browsers hide APIs that need a secure
// context (https or localhost). Using one of them crashed the page once, so keep them out of the client.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { copyText } from './clipboard.js';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const SECURE_ONLY = [/crypto\.randomUUID/, /crypto\.subtle/, /navigator\.clipboard/, /navigator\.share\b/];
// The one place allowed to touch the clipboard API, because it checks for it and falls back.
const ALLOWED = new Set([join(SRC, 'lib', 'clipboard.js')]);

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(jsx?|tsx?)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });
}

test('client code uses no API that only exists on https or localhost', () => {
  const offenders = sourceFiles(SRC)
    .filter((file) => !ALLOWED.has(file))
    .flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return SECURE_ONLY.filter((pattern) => pattern.test(text)).map((pattern) => `${file}: ${pattern}`);
    });
  assert.deepEqual(offenders, []);
});

test('copyText falls back to a selection copy when the clipboard API is missing (plain http)', async () => {
  const calls = [];
  const area = {
    style: {},
    setAttribute: () => {},
    select: () => calls.push('select'),
    remove: () => calls.push('remove'),
  };
  globalThis.document = {
    createElement: () => area,
    body: { appendChild: () => calls.push('append') },
    execCommand: (command) => {
      calls.push(command);
      return true;
    },
  };
  try {
    await copyText('AA:BB:CC:DD:EE:FF');
    assert.equal(area.value, 'AA:BB:CC:DD:EE:FF');
    assert.deepEqual(calls, ['append', 'select', 'copy', 'remove']);
  } finally {
    delete globalThis.document;
  }
});
