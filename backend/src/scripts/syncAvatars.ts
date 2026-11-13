import { avatarSyncService } from '../modules/sync/avatarSync.service';
import { prisma } from '../config/database';

async function main() {
  const args = process.argv.slice(2);
  const isAuditOnly = args.includes('--audit-only');
  const isForceLive = args.includes('--force-live');

  const maxArgIndex = args.indexOf('--max');
  const maxAvatars = maxArgIndex !== -1 && args[maxArgIndex + 1] ? parseInt(args[maxArgIndex + 1], 10) : undefined;

  const safetyArgIndex = args.indexOf('--safety-buffer');
  const safetyBuffer = safetyArgIndex !== -1 && args[safetyArgIndex + 1] ? parseInt(args[safetyArgIndex + 1], 10) : 10;

  console.log('='.repeat(70));
  console.log('🎾 TennisScope ATP Top 100 Avatar Sync & Integrity Tool');
  console.log('='.repeat(70));

  try {
    if (isAuditOnly || !isForceLive) {
      if (!isAuditOnly) {
        console.log('ℹ️  Automatic avatar downloading is currently paused.');
        console.log('   Running in safe audit & local repair mode (0 API quota used).');
        console.log('   (To explicitly run a live network batch, pass --force-live)\n');
      } else {
        console.log('🔍 Running audit-only mode with automatic DB/disk repair...\n');
      }

      const audit = await avatarSyncService.auditCurrentTop100({ autoRepair: true });

      console.log(`📅 Snapshot date:       ${audit.rankingDate ? audit.rankingDate.toISOString().slice(0, 10) : 'None'}`);
      console.log(`👥 Total Top 100:       ${audit.totalPlayers}`);
      console.log(`✅ Valid Avatars:       ${audit.validAvatars} (${Math.round((audit.validAvatars / (audit.totalPlayers || 1)) * 100)}%)`);
      console.log(`❌ Missing Avatars:     ${audit.missingAvatars}`);
      console.log(`🔧 Repaired Mismatches: ${audit.repairedMismatches}`);
      console.log(`⏳ Pending Jobs:        ${audit.pendingJobs}`);

      console.log('\nTop 10 Player Avatar Status:');
      audit.items.slice(0, 10).forEach((item) => {
        const flag = item.isValid ? '✅' : '❌';
        console.log(`  ${flag} #${item.rank.toString().padStart(2, ' ')} ${item.name.padEnd(24, ' ')} (${item.countryCode || '—'}) file: ${item.hasFileOnDisk ? 'YES' : 'NO '} db: ${item.dbImagePath ? 'YES' : 'NO '}`);
      });
    } else {
      console.log(`🚀 Starting Top 100 Avatar Batch Sync (safety buffer: ${safetyBuffer}, max: ${maxAvatars ?? 'auto'})...\n`);
      const result = await avatarSyncService.syncTop100Avatars({
        maxAvatars,
        safetyBuffer,
      });

      console.log('='.repeat(70));
      console.log('📊 AVATAR BATCH SYNC SUMMARY');
      console.log('='.repeat(70));
      console.log(`Total Top 100 Players:    ${result.totalTop100}`);
      console.log(`Already Valid (before):   ${result.alreadyValidBefore}`);
      console.log(`DB Mismatches Repaired:   ${result.repairedBefore}`);
      console.log(`Downloaded in Batch:      ${result.downloaded}`);
      console.log(`Failed / No Image:        ${result.failed}`);
      console.log(`Pending Avatars Left:     ${result.pendingRemaining}`);
      console.log(`Valid Avatars Now:        ${result.validAvatarsAfter} / ${result.totalTop100} (${result.coveragePct}%)`);
      console.log(`API Requests Used:        ${result.requestsUsed}`);
      console.log(`Remaining API Budget:     ${result.remainingBudget} (Safety buffer: ${result.safetyBuffer})`);

      if (result.processedPlayers.length > 0) {
        console.log('\nProcessed Players in this batch:');
        result.processedPlayers.forEach((p) => {
          console.log(`  #${p.rank.toString().padStart(2, ' ')} ${p.name.padEnd(24, ' ')} -> ${p.status}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Avatar sync script encountered an error:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
