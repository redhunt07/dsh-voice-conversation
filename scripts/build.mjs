import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  write: false,
});
let source = result.outputFiles[0].text;
const exports = source.match(/\nexport \{\n([\s\S]*?)\n\};\s*$/);
const declarations = source.match(/^function apply\(/gm);
if (!exports || declarations?.length !== 1) {
  throw new Error('Unexpected bundle shape: cannot emit a direct apply export');
}
const entries = exports[1].split('\n');
if (entries.filter((entry) => entry.trim().replace(/,$/, '') === 'apply').length !== 1) {
  throw new Error('Expected exactly one apply export');
}
// Keep a direct declaration visible to simple static plugin-discovery scanners.
// The function body and its public export name are unchanged.
source = source.replace(exports[0], '\nexport {\n' + entries.filter(
  (entry) => entry.trim().replace(/,$/, '') !== 'apply',
).join('\n') + '\n};\n');
source = source.replace(/^function apply\(/m, 'export function apply(');
await mkdir(new URL('../lib/', import.meta.url), { recursive: true });
await writeFile(new URL('../lib/index.js', import.meta.url), source);
console.log('Built lib/index.js with a direct apply export');
