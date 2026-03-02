import { build, context } from 'esbuild';
import { rmSync } from 'node:fs';

const watchMode = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  external: ['vscode'],
  sourcemap: true,
  sourcesContent: false,
  tsconfig: 'tsconfig.json',
  logLevel: 'info',
};

rmSync('dist', { recursive: true, force: true });

if (watchMode) {
  const buildContext = await context(buildOptions);
  await buildContext.watch();
  process.stdout.write('esbuild watching for changes...\n');
} else {
  await build(buildOptions);
}
