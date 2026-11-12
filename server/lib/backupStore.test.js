import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createBackupStore } from './backupStore.js';

async function withStore(run) {
  const directory = await mkdtemp(join(tmpdir(), 'velop-backups-'));
  try {
    await run(createBackupStore(join(directory, 'backups')), join(directory, 'backups'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('save writes an owner-only file that read returns unchanged', async () => {
  await withStore(async (store, directory) => {
    const file = await store.save({ label: 'Wi-Fi settings', setAction: 'a/SetB', payload: { x: 1 } });
    assert.equal((await stat(join(directory, file))).mode & 0o777, 0o600);
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.deepEqual((await store.read(file)).payload, { x: 1 });
  });
});

test('list returns newest first and never includes the payload', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'velop-backups-'));
  try {
    let tick = 0;
    const store = createBackupStore(directory, { now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, (tick += 1))) });
    await store.save({ label: 'first', setAction: 'a/SetB', payload: { secret: 'p' } });
    await store.save({ label: 'second', setAction: 'a/SetB', payload: { secret: 'p' } });
    const list = await store.list();
    assert.deepEqual(
      list.map((item) => item.label),
      ['second', 'first'],
    );
    assert.equal(JSON.stringify(list).includes('secret'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('read refuses path traversal and unknown files', async () => {
  await withStore(async (store) => {
    await assert.rejects(store.read('../../etc/passwd'), { status: 400 });
    await assert.rejects(store.read('..%2Fx.json'), { status: 400 });
    await assert.rejects(store.read('missing.json'), { status: 404 });
  });
});

test('list on a folder that does not exist yet is simply empty', async () => {
  await withStore(async (store) => {
    assert.deepEqual(await store.list(), []);
  });
});
