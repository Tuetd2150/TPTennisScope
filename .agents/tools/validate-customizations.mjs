#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const agents = path.join(root, '.agents');
let failures = 0;

function pass(msg) { console.log(`PASS: ${msg}`); }
function fail(msg) { failures += 1; console.error(`FAIL: ${msg}`); }

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    out[key] = value;
  }
  return out;
}

const agentsMd = path.join(root, 'AGENTS.md');
if (fs.existsSync(agentsMd) && fs.statSync(agentsMd).size > 100) pass('AGENTS.md');
else fail('AGENTS.md thiếu hoặc quá ngắn');

const rulesDir = path.join(agents, 'rules');
const validTriggers = new Set(['always_on', 'model_decision', 'glob', 'manual']);
if (!fs.existsSync(rulesDir)) {
  fail('.agents/rules không tồn tại');
} else {
  const rules = fs.readdirSync(rulesDir).filter((x) => x.endsWith('.md'));
  if (!rules.length) fail('không có rule .md');
  for (const name of rules) {
    const fm = frontmatter(path.join(rulesDir, name));
    if (!fm) { fail(`rule ${name} thiếu YAML frontmatter`); continue; }
    if (!validTriggers.has(fm.trigger)) { fail(`rule ${name} có trigger không hợp lệ: ${fm.trigger}`); continue; }
    if (fm.trigger === 'model_decision' && !fm.description) { fail(`rule ${name} model_decision thiếu description`); continue; }
    pass(`rule ${name}`);
  }
}

const skillsDir = path.join(agents, 'skills');
if (!fs.existsSync(skillsDir)) {
  fail('.agents/skills không tồn tại');
} else {
  const dirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((x) => x.isDirectory());
  if (!dirs.length) fail('không có skill');
  for (const d of dirs) {
    const skillFile = path.join(skillsDir, d.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) { fail(`${d.name} thiếu SKILL.md`); continue; }
    const fm = frontmatter(skillFile);
    if (!fm?.description) { fail(`${d.name}/SKILL.md thiếu description`); continue; }
    const skillName = fm.name || d.name;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName)) { fail(`${d.name} có name không hợp lệ: ${skillName}`); continue; }
    pass(`skill ${skillName}`);
  }
}


const requiredSupportFiles = [
  path.join(agents, 'skills', 'tennisscope-git-finish', 'scripts', 'pre-push-check.mjs'),
];
for (const supportFile of requiredSupportFiles) {
  if (fs.existsSync(supportFile) && fs.statSync(supportFile).size > 100) pass(`support ${path.relative(root, supportFile)}`);
  else fail(`thiếu support file ${path.relative(root, supportFile)}`);
}

for (const resource of ['provider-contract.md', 'lessons-learned.md']) {
  const p = path.join(agents, 'resources', resource);
  if (fs.existsSync(p)) pass(`resource ${resource}`);
  else fail(`thiếu resource ${resource}`);
}

console.log('');
if (failures) {
  console.error(`Customization pack có ${failures} lỗi.`);
  process.exit(1);
}
console.log('Customization pack hợp lệ.');
