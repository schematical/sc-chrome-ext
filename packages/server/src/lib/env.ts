import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

let loaded = false;

export function loadEnv(): void {
  if (loaded) {
    return;
  }

  const cwd = process.cwd();
  const basePath = path.resolve(cwd, '.env');
  const localPath = path.resolve(cwd, '.env.local');

  if (fs.existsSync(basePath)) {
    dotenv.config({ path: basePath });
  }

  if (fs.existsSync(localPath)) {
    dotenv.config({ path: localPath, override: true });
  }

  loaded = true;
}
