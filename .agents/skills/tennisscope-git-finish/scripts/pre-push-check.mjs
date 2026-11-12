#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import path from 'node:path';

let failures = 0;
let warnings = 0;

function run(args, options = {}) {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim();
    throw new Error(stderr || `git ${args.join(' ')} failed`);
  }
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`WARN: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function isBlockedFile(file) {
  const f = file.replaceAll('\\', '/').toLowerCase();

  if (/(^|\/)\.env($|\.)/.test(f) && !/(^|\/)\.env\.example$/.test(f)) return true;
  if (/(^|\/)(id_rsa|id_ed25519)$/.test(f)) return true;
  if (/\.(pem|key|p12|pfx)$/.test(f)) return true;
  if (/(^|\/)(credentials?|secrets?)(\.|\/|$)/.test(f)) return true;
  if (/(^|\/)(node_modules|dist|build|coverage|\.cache)(\/|$)/.test(f)) return true;
  if (/\.(log|sqlite|sqlite3|db)$/.test(f)) return true;
  if (/(^|\/)(tmp|temp)(\/|$)/.test(f)) return true;
  return false;
}

function looksLikeRealSecret(line) {
  const text = line.trim();
  if (!text.startsWith('+') || text.startsWith('+++')) return false;

  const value = text.slice(1);
  const placeholder = /(your[_-]|example|placeholder|changeme|replace[_-]?me|<[^>]+>|\$\{[^}]+\})/i;
  if (placeholder.test(value)) return false;

  const patterns = [
    /RAPIDAPI_KEY\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}/i,
    /(API_KEY|ACCESS_TOKEN|AUTH_TOKEN|SECRET_KEY|PRIVATE_KEY)\s*[:=]\s*["']?[A-Za-z0-9_\-\/+=]{12,}/i,
    /DATABASE_URL\s*[:=]\s*["']?postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  ];

  return patterns.some((pattern) => pattern.test(value));
}

try {
  const inside = run(['rev-parse', '--is-inside-work-tree']);
  if (inside !== 'true') {
    fail('Thư mục hiện tại không phải Git worktree.');
  } else {
    pass('Git worktree hợp lệ');
  }

  const branch = run(['branch', '--show-current']);
  if (!branch) {
    fail('Detached HEAD hoặc không xác định được current branch.');
  } else {
    pass(`Current branch: ${branch}`);
    if (branch === 'main' || branch === 'master') {
      warn(`Đang ở branch ${branch}; chỉ push nếu user thực sự yêu cầu branch hiện tại.`);
    }
  }

  const remotes = run(['remote']);
  const remoteNames = remotes ? remotes.split(/\r?\n/).filter(Boolean) : [];
  if (!remoteNames.includes('origin')) {
    fail('Chưa có remote origin.');
  } else {
    const originUrl = run(['remote', 'get-url', 'origin']);
    pass(`Remote origin: ${originUrl}`);
  }

  const stagedRaw = run(['diff', '--cached', '--name-only', '-z']);
  const staged = stagedRaw ? stagedRaw.split('\0').filter(Boolean) : [];

  if (!staged.length) {
    fail('Không có file nào đang staged để commit.');
  } else {
    pass(`Có ${staged.length} file staged.`);
  }

  const blocked = staged.filter(isBlockedFile);
  for (const file of blocked) {
    fail(`File staged có rủi ro secret/generated: ${file}`);
  }

  const patch = run(['diff', '--cached', '--no-ext-diff', '--unified=0']);
  const lines = patch.split(/\r?\n/);
  const secretLines = lines.filter(looksLikeRealSecret);
  if (secretLines.length) {
    fail(`Staged diff có ${secretLines.length} dòng nghi chứa secret thật. Giá trị secret không được in ra.`);
  } else {
    pass('Không phát hiện pattern secret phổ biến trong staged diff');
  }

  const status = run(['status', '--short']);
  if (status) {
    const unstaged = status
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => {
        const indexStatus = line[0];
        const worktreeStatus = line[1];
        return worktreeStatus && worktreeStatus !== ' ';
      });
    if (unstaged.length) {
      warn(`Working tree còn ${unstaged.length} thay đổi chưa staged; đảm bảo chúng không thuộc commit hiện tại.`);
    }
  }
} catch (error) {
  fail(error.message);
}

console.log('');
if (failures) {
  console.error(`Pre-push check FAIL (${failures} lỗi, ${warnings} cảnh báo).`);
  process.exit(1);
}

console.log(`Pre-push check PASS (${warnings} cảnh báo).`);
