import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] || path.join(root, 'github-package'));
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const original = pkg.name;
const owner = (process.env.GITHUB_REPOSITORY_OWNER || 'redhunt07').toLowerCase();
if (owner !== 'redhunt07' || original !== 'dsh-voice-conversation') {
  throw new Error('Unexpected owner or source package identity');
}
const scoped = `@${owner}/${original}`;
await fs.mkdir(output, { recursive: false });
for (const entry of pkg.files) {
  const relative = entry.replace(/\/$/, '');
  await fs.cp(path.join(root, relative), path.join(output, relative), {
    recursive: true,
    filter: (source) => !source.split(path.sep).some((part) => ['node_modules', '__pycache__', '.git'].includes(part)) && !source.endsWith('.pyc'),
  });
}
pkg.name = scoped;
pkg.publishConfig = { ...pkg.publishConfig, registry: 'https://npm.pkg.github.com', access: 'public' };
await fs.writeFile(path.join(output, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
const clientPath = path.join(output, 'src/client.js');
const client = await fs.readFile(clientPath, 'utf8');
const originalId = `id: '${original}'`;
if (!client.includes(originalId)) throw new Error('Client registration identity was not found');
await fs.writeFile(clientPath, client.replace(originalId, `id: '${scoped}'`));
const patchPath = path.join(output, 'cordis.patch.yml');
const patch = await fs.readFile(patchPath, 'utf8');
if (!patch.includes(`name: ${original}`)) throw new Error('Bundle package identity was not found');
await fs.writeFile(patchPath, patch.replace(`name: ${original}`, `name: '${scoped}'`));
console.log(`Prepared ${scoped}@${pkg.version}`);
