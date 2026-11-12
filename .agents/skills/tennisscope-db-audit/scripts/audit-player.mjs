#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

if (has('--help') || has('-h')) {
  console.log(`TennisScope DB Audit\n\nUsage:\n  node .agents/skills/tennisscope-db-audit/scripts/audit-player.mjs --rank <N> [--year 2026]\n  node .agents/skills/tennisscope-db-audit/scripts/audit-player.mjs --external-id <ID> [--year 2026]\n\nOptions:\n  --rank <N>          Resolve player từ latest RankingSnapshot theo rank hiện tại trong DB\n  --external-id <ID>  Resolve trực tiếp bằng Player.externalId\n  --year <YYYY>       Season cần audit, mặc định năm hiện tại\n  --help              Hiển thị hướng dẫn\n\nScript chỉ đọc PostgreSQL, không gọi Tennis provider.`);
  process.exit(0);
}

const rankArg = valueOf('--rank');
const externalArg = valueOf('--external-id');
const year = Number(valueOf('--year') ?? new Date().getFullYear());

if ((!rankArg && !externalArg) || (rankArg && externalArg)) {
  console.error('Chọn đúng một selector: --rank hoặc --external-id.');
  process.exit(2);
}
if (!Number.isInteger(year) || year < 2000 || year > 2100) {
  console.error('--year không hợp lệ.');
  process.exit(2);
}

async function loadPrismaClient() {
  try {
    return (await import('@prisma/client')).PrismaClient;
  } catch (firstError) {
    const candidates = [
      path.resolve(process.cwd(), 'node_modules/@prisma/client/index.js'),
      path.resolve(process.cwd(), 'backend/node_modules/@prisma/client/index.js'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const mod = await import(pathToFileURL(candidate).href);
        return mod.PrismaClient;
      }
    }
    console.error('Không tìm thấy @prisma/client. Hãy chạy script từ root D:\\TPTennisScope sau khi dependencies đã được cài.');
    throw firstError;
  }
}

function loadBudget() {
  const envFiles = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'backend/.env')];
  for (const file of envFiles) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const m = text.match(/^DAILY_API_REQUEST_BUDGET\s*=\s*([^#\r\n]+)/m);
    if (m) {
      const n = Number(m[1].trim().replace(/^['"]|['"]$/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  const envN = Number(process.env.DAILY_API_REQUEST_BUDGET);
  return Number.isFinite(envN) ? envN : null;
}

function printable(value) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

function cleanRow(row) {
  if (!row || typeof row !== 'object') return row;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, printable(v)]));
}

function q(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

const PrismaClient = await loadPrismaClient();
const prisma = new PrismaClient();

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1) AS ok`,
    name,
  );
  return Boolean(rows?.[0]?.ok);
}

async function columns(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position`,
    name,
  );
  return new Set(rows.map((r) => r.column_name));
}

async function first(sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return rows?.[0] ?? null;
}

try {
  for (const required of ['Player', 'RankingSnapshot']) {
    if (!(await tableExists(required))) {
      throw new Error(`Không tìm thấy table ${required}. Kiểm tra DATABASE_URL/schema hiện tại.`);
    }
  }

  let target;
  let latestRankingDate = null;

  if (rankArg) {
    const rank = Number(rankArg);
    if (!Number.isInteger(rank) || rank < 1 || rank > 5000) throw new Error('--rank không hợp lệ.');

    const latest = await first(`SELECT MAX("rankingDate") AS "rankingDate" FROM "RankingSnapshot"`);
    latestRankingDate = latest?.rankingDate ?? null;
    if (!latestRankingDate) throw new Error('RankingSnapshot chưa có rankingDate.');

    target = await first(
      `SELECT p.*, rs."rank" AS "auditRank", rs."points" AS "auditPoints", rs."rankingDate" AS "auditRankingDate"
       FROM "RankingSnapshot" rs
       JOIN "Player" p ON p."id" = rs."playerId"
       WHERE rs."rankingDate" = $1 AND rs."rank" = $2
       LIMIT 1`,
      latestRankingDate,
      rank,
    );
  } else {
    const externalId = String(externalArg);
    target = await first(`SELECT * FROM "Player" WHERE CAST("externalId" AS TEXT) = $1 LIMIT 1`, externalId);
    const latest = await first(`SELECT MAX("rankingDate") AS "rankingDate" FROM "RankingSnapshot"`);
    latestRankingDate = latest?.rankingDate ?? null;
    if (target && latestRankingDate) {
      const rs = await first(
        `SELECT "rank", "points", "rankingDate" FROM "RankingSnapshot" WHERE "playerId" = $1 AND "rankingDate" = $2 LIMIT 1`,
        target.id,
        latestRankingDate,
      );
      if (rs) Object.assign(target, { auditRank: rs.rank, auditPoints: rs.points, auditRankingDate: rs.rankingDate });
    }
  }

  if (!target) throw new Error('Không resolve được target player từ database.');

  const player = cleanRow(target);
  const profileCandidates = ['birthday', 'countryCode', 'countryAcr', 'height', 'weight', 'plays', 'backhand', 'coach', 'imagePath', 'birthplace', 'residence', 'turnedPro', 'careerHighRank', 'careerHighDate'];
  const profile = Object.fromEntries(profileCandidates.filter((k) => k in player).map((k) => [k, player[k]]));
  const populatedProfileFields = Object.values(profile).filter((v) => v !== null && v !== undefined && v !== '').length;

  let careerCount = null;
  if (await tableExists('PlayerCareerStat')) {
    const c = await first(`SELECT COUNT(*)::int AS n FROM "PlayerCareerStat" WHERE "playerId" = $1`, target.id);
    careerCount = c?.n ?? 0;
  }

  let titlesCount = null;
  if (await tableExists('PlayerTitle')) {
    const c = await first(`SELECT COUNT(*)::int AS n FROM "PlayerTitle" WHERE "playerId" = $1`, target.id);
    titlesCount = c?.n ?? 0;
  }

  let matchCount = null;
  let statCount = null;
  if (await tableExists('Match')) {
    const mc = await columns('Match');
    const p1 = ['player1Id', 'homePlayerId'].find((x) => mc.has(x));
    const p2 = ['player2Id', 'awayPlayerId'].find((x) => mc.has(x));
    const dateCol = ['date', 'matchDate', 'startDate', 'playedAt'].find((x) => mc.has(x));
    if (p1 && p2) {
      const yearClause = dateCol ? ` AND EXTRACT(YEAR FROM ${q(dateCol)}) = $2` : '';
      const c = await first(
        `SELECT COUNT(*)::int AS n FROM "Match" WHERE (${q(p1)} = $1 OR ${q(p2)} = $1)${yearClause}`,
        ...(dateCol ? [target.id, year] : [target.id]),
      );
      matchCount = c?.n ?? 0;

      if (await tableExists('MatchPlayerStat')) {
        const sc = await columns('MatchPlayerStat');
        if (sc.has('playerId')) {
          if (sc.has('matchId') && dateCol) {
            const c2 = await first(
              `SELECT COUNT(*)::int AS n
               FROM "MatchPlayerStat" s
               JOIN "Match" m ON m."id" = s."matchId"
               WHERE s."playerId" = $1 AND EXTRACT(YEAR FROM m.${q(dateCol)}) = $2`,
              target.id,
              year,
            );
            statCount = c2?.n ?? 0;
          } else {
            const c2 = await first(`SELECT COUNT(*)::int AS n FROM "MatchPlayerStat" WHERE "playerId" = $1`, target.id);
            statCount = c2?.n ?? 0;
          }
        }
      }
    }
  }

  const syncSummary = [];
  let apiUsage = null;
  if (await tableExists('SyncJob')) {
    const jc = await columns('SyncJob');
    const typeCol = ['type', 'jobType'].find((x) => jc.has(x));
    const statusCol = ['status'].find((x) => jc.has(x));
    const playerCol = ['playerId'].find((x) => jc.has(x));
    const createdCol = ['createdAt', 'startedAt', 'updatedAt'].find((x) => jc.has(x));

    if (typeCol) {
      const selectStatus = statusCol ? `, ${q(statusCol)} AS status` : '';
      const groupStatus = statusCol ? `, ${q(statusCol)}` : '';
      const wherePlayer = playerCol ? ` WHERE (${q(playerCol)} = $1 OR ${q(playerCol)} IS NULL)` : '';
      const rows = await prisma.$queryRawUnsafe(
        `SELECT ${q(typeCol)} AS type${selectStatus}, COUNT(*)::int AS count
         FROM "SyncJob"${wherePlayer}
         GROUP BY ${q(typeCol)}${groupStatus}
         ORDER BY ${q(typeCol)}`,
        ...(playerCol ? [target.id] : []),
      );
      syncSummary.push(...rows.map(cleanRow));

      if (createdCol) {
        const usage = await first(
          `SELECT COUNT(*)::int AS n FROM "SyncJob"
           WHERE ${q(typeCol)} = 'API_USAGE'
             AND (${q(createdCol)} AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`,
        );
        apiUsage = usage?.n ?? 0;
      }
    }
  }

  const completedTypes = new Set(
    syncSummary
      .filter((x) => String(x.status ?? '').toUpperCase() === 'COMPLETED')
      .map((x) => String(x.type ?? '').toUpperCase()),
  );

  const likelyProfileComplete = populatedProfileFields >= 3 || completedTypes.has('PLAYER_PROFILE');
  const likelyCareerComplete = careerCount != null ? careerCount > 0 : completedTypes.has('PLAYER_CAREER');
  const likelyTitlesComplete = (titlesCount != null && titlesCount > 0) || completedTypes.has('PLAYER_TITLES');
  const likelySeasonPresent = (matchCount ?? 0) > 0 || completedTypes.has('BACKFILL');

  let minimumRequests = 0;
  if (!likelyProfileComplete) minimumRequests += 1;
  if (!likelyCareerComplete) minimumRequests += 1;
  if (!likelyTitlesComplete) minimumRequests += 1;
  if (!likelySeasonPresent) minimumRequests += 1;

  const budget = loadBudget();

  console.log('\n=== TennisScope DB Audit ===');
  console.log(`Latest rankingDate: ${printable(latestRankingDate) ?? '—'}`);
  console.log(`Target: ${player.name ?? '—'} | rank #${player.auditRank ?? '—'} | internal id=${player.id} | externalId=${player.externalId}`);
  console.log(`Points: ${player.auditPoints ?? '—'} | Season: ${year}`);
  console.log('\nProfile:');
  console.log(JSON.stringify(profile, null, 2));
  console.log(`Profile likely complete: ${likelyProfileComplete ? 'YES' : 'NO/UNKNOWN'}`);
  console.log(`Career rows: ${careerCount ?? 'UNKNOWN'}`);
  console.log(`Title rows: ${titlesCount ?? 'UNKNOWN'}`);
  console.log(`Season matches: ${matchCount ?? 'UNKNOWN'}`);
  console.log(`Season MatchPlayerStat rows: ${statCount ?? 'UNKNOWN'}`);

  if (syncSummary.length) {
    console.log('\nSyncJob summary:');
    for (const row of syncSummary) console.log(`- ${row.type}${row.status ? ` / ${row.status}` : ''}: ${row.count}`);
  }

  console.log('\nQuota (local audit):');
  console.log(`API_USAGE today: ${apiUsage ?? 'UNKNOWN'}`);
  console.log(`Configured DAILY_API_REQUEST_BUDGET: ${budget ?? 'UNKNOWN'}`);
  if (apiUsage != null && budget != null) console.log(`Remaining local budget: ${Math.max(0, budget - apiUsage)}`);

  console.log('\nRequest estimate:');
  console.log(`Minimum provider requests (conservative): ${minimumRequests}`);
  console.log('Lưu ý: season matchCount > 0 chưa tự chứng minh season COMPLETE; kiểm tra SyncJob/provider pagination nếu cần.');
  console.log('Script này không thực hiện provider request.\n');
} catch (error) {
  console.error(`Audit thất bại: ${error?.message ?? error}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
