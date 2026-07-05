import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'packages', 'desktop', 'dist', 'package');
const target = path.join(root, 'build', 'desktop');

if (!existsSync(source)) {
  throw new Error(`Desktop package output not found: ${source}`);
}

await rm(target, { recursive: true, force: true });
await mkdir(path.dirname(target), { recursive: true });
await cp(source, target, { recursive: true });

console.log(`Desktop build copied to ${target}`);
