// Saves the router's settings as they were BEFORE every change so any change can be undone.
// Backups can contain Wi-Fi passwords, so the folder is owner-only (0700) and each file is 0600.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { httpError } from './httpError.js';

const FILE_PATTERN = /^[\w.-]+\.json$/;

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function createBackupStore(directory, { now = () => new Date() } = {}) {
  return {
    async save({ label, setAction, payload }) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const time = now();
      const file = `${time.toISOString().replace(/[:.]/g, '-')}-${slug(label)}.json`;
      const body = JSON.stringify({ time: time.toISOString(), label, setAction, payload }, null, 2);
      await writeFile(join(directory, file), body, { mode: 0o600 });
      return file;
    },

    // Metadata only: the payload (which may hold a password) never leaves the server in a listing.
    async list() {
      let names;
      try {
        names = await readdir(directory);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return [];
        }
        throw error;
      }
      const entries = await Promise.all(
        names
          .filter((name) => FILE_PATTERN.test(name))
          .map(async (file) => {
            const { time, label } = JSON.parse(await readFile(join(directory, file), 'utf8'));
            return { file, time, label };
          }),
      );
      return entries.sort((a, b) => b.time.localeCompare(a.time));
    },

    async read(file) {
      if (!FILE_PATTERN.test(file) || file.includes('..')) {
        throw httpError(400, 'Invalid backup name');
      }
      try {
        return JSON.parse(await readFile(join(directory, file), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw httpError(404, 'No such backup');
        }
        throw error;
      }
    },
  };
}
