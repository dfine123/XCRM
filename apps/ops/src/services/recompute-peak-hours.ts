import { prisma, AccountStatus } from '@xcrm/db';
import { derivePeakHours } from '@/lib/engagement-aggregation';
import { loadEngagementSamplesForAccount } from '@/app/console/_loaders/engagement-samples';

/**
 * Minimum samples per account before we'll touch its `peakHours`.
 * Below this, the scheduler keeps using its DEFAULT_PEAK_HOURS
 * fallback rather than over-fitting to a couple of lucky posts.
 */
const MIN_SAMPLES_PER_ACCOUNT = 5;
const TOP_K_HOURS = 4;

/**
 * Recompute `Account.peakHours` for every generation-eligible account
 * with enough engagement signal. Build D's scheduler reads
 * `peakHours` already; the moment we write real values, the next
 * scheduler call picks them up.
 *
 * Returns per-run summary so the cron route can log a quiet success.
 */
export async function recomputePeakHoursForEligibleAccounts(): Promise<{
  accountsScanned: number;
  accountsUpdated: number;
  accountsSkipped: number;
}> {
  const accounts = await prisma.account.findMany({
    where: {
      deletedAt: null,
      status: {
        in: [
          AccountStatus.ACTIVE_RAMPING,
          AccountStatus.ACTIVE_ESTABLISHED,
          AccountStatus.ACTIVE_MATURE,
          AccountStatus.FRESH_BUILD,
        ],
      },
      model: { deletedAt: null },
    },
    select: { id: true, peakHours: true },
  });

  let updated = 0;
  let skipped = 0;
  for (const acct of accounts) {
    const samples = await loadEngagementSamplesForAccount(acct.id);
    if (samples.length < MIN_SAMPLES_PER_ACCOUNT) {
      skipped++;
      continue;
    }
    const next = derivePeakHours(samples, TOP_K_HOURS);
    // Cheap idempotency: only write when the value actually changes.
    if (
      next.length === acct.peakHours.length &&
      next.every((h, i) => h === acct.peakHours[i])
    ) {
      skipped++;
      continue;
    }
    await prisma.account.update({
      where: { id: acct.id },
      data: { peakHours: next },
    });
    updated++;
  }

  return {
    accountsScanned: accounts.length,
    accountsUpdated: updated,
    accountsSkipped: skipped,
  };
}
