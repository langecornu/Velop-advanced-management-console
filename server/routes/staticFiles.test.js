import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createApp } from '../app.js';

async function withApp(prepare, run) {
  const directory = await mkdtemp(join(tmpdir(), 'velop-static-'));
  const clientDist = join(directory, 'dist');
  await prepare(clientDist);
  const config = { allowedOrigin: 'http://localhost:5173', dataDir: join(directory, 'data') };
  const server = await new Promise((resolve) => {
    const listening = createApp({ client: {}, config, clientDist }).listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`, clientDist);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

test('without a build the home page explains how to build it instead of "Cannot GET /"', async () => {
  await withApp(
    async () => {},
    async (base) => {
      const response = await fetch(`${base}/`);
      assert.equal(response.status, 404);
      assert.match(await response.text(), /npm run build/);
    },
  );
});

test('a build made after the server started is served without restarting it', async () => {
  await withApp(
    async () => {},
    async (base, clientDist) => {
      assert.equal((await fetch(`${base}/`)).status, 404);
      await mkdir(clientDist, { recursive: true });
      await writeFile(join(clientDist, 'index.html'), '<html>hello</html>');
      const response = await fetch(`${base}/`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /hello/);
    },
  );
});

test('with a build, an unknown page is a plain "Not found" and API routes are untouched', async () => {
  await withApp(
    async (clientDist) => {
      await mkdir(clientDist, { recursive: true });
      await writeFile(join(clientDist, 'index.html'), '<html>hello</html>');
    },
    async (base) => {
      const missing = await fetch(`${base}/nope`);
      assert.equal(missing.status, 404);
      assert.equal(await missing.text(), 'Not found');
      assert.equal((await fetch(`${base}/api/health`)).status, 200);
    },
  );
});
