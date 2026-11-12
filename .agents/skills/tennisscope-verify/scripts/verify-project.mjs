#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const help = args.has('--help') || args.has('-h');
const dryRun = args.has('--dry-run');

if (help) {
  console.log(`TennisScope Project Verify\n\nUsage:\n  node .agents/skills/tennisscope-verify/scripts/verify-project.mjs\n  node .agents/skills/tennisscope-verify/scripts/verify-project.mjs --dry-run\n\nChạy root npm scripts theo thứ tự: typecheck, lint, test, build.\nScript không gọi Tennis provider.`);
  process.exit(0);
}

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('Không tìm thấy package.json. Hãy chạy từ root D:\\TPTennisScope.');
  process.exit(2);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const desired = ['typecheck', 'lint', 'test', 'build'];
const available = desired.filter((name) => pkg.scripts?.[name]);
const missing = desired.filter((name) => !pkg.scripts?.[name]);

console.log('=== TennisScope Verify ===');
console.log(`Root: ${root}`);
console.log(`Scripts sẽ chạy: ${available.length ? available.join(', ') : 'không có'}`);
if (missing.length) console.log(`Scripts không tồn tại ở root package.json: ${missing.join(', ')}`);

function run(command, commandArgs = []) {
  console.log(`\n> ${command} ${commandArgs.join(' ')}`.trim());
  if (dryRun) return { status: 0, dryRun: true };
  return spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

if (dryRun) {
  console.log('\n[DRY RUN] Không chạy command thật.');
  for (const script of available) console.log(`npm run ${script}`);
  console.log('git status --short');
  console.log('git diff -- backend/prisma/schema.prisma');
  process.exit(0);
}

const results = [];
for (const script of available) {
  const r = run('npm', ['run', script]);
  results.push({ script, status: r.status ?? 1 });
  if ((r.status ?? 1) !== 0) {
    console.log(`\n${script}: FAIL`);
    break;
  }
}

console.log('\n=== Git status ===');
run('git', ['status', '--short']);

console.log('\n=== Prisma schema diff ===');
run('git', ['diff', '--', 'backend/prisma/schema.prisma']);

console.log('\n=== Summary ===');
for (const item of results) console.log(`${item.script}: ${item.status === 0 ? 'PASS' : 'FAIL'}`);
for (const script of missing) console.log(`${script}: NOT FOUND`);

const failed = results.some((x) => x.status !== 0);
process.exitCode = failed ? 1 : 0;
