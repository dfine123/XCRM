import { QUEUE_NAMES, queues } from './queues';

/**
 * Recurring job schedule. One entry per §4 row.
 * Actual job handlers arrive in Phase 1+; Phase 0 registers empty queues only.
 */
export const RECURRING_JOBS: Array<{
  queue: keyof typeof QUEUE_NAMES;
  cron: string;
  description: string;
}> = [
  { queue: 'postGenerator', cron: '0 */4 * * *', description: 'every 4h' },
  { queue: 'taskBatchAssembler', cron: '0 */2 * * *', description: 'every 2h' },
  { queue: 'engagementSnapshotter', cron: '15 * * * *', description: 'hourly' },
  { queue: 'insightComputer', cron: '30 3 * * *', description: 'nightly 03:30' },
  { queue: 'campComposer', cron: '0 9 * * 0', description: 'Sunday 09:00' },
  { queue: 'campAutoActivator', cron: '0 20 * * 0', description: 'Sunday 20:00' },
  { queue: 'runwayComputer', cron: '0 4 * * *', description: 'nightly 04:00' },
  { queue: 'retentionRiskComputer', cron: '15 4 * * *', description: 'nightly 04:15' },
  { queue: 'contentRequestGenerator', cron: '30 4 * * *', description: 'nightly 04:30' },
  { queue: 'followerSnapshotter', cron: '5 */6 * * *', description: 'every 6h' },
  { queue: 'peakHourComputer', cron: '0 5 * * 1', description: 'Monday 05:00' },
  { queue: 'staleInsightRetirer', cron: '45 5 * * 1', description: 'Monday 05:45' },
  {
    queue: 'driveSync',
    cron: process.env.DRIVE_SYNC_POLL_CRON || '*/10 * * * *',
    description: 'every 10m — fan out one sync-source job per active DriveSource',
  },
];

export async function registerRecurringJobs(): Promise<void> {
  for (const entry of RECURRING_JOBS) {
    const qname = QUEUE_NAMES[entry.queue];
    await queues[qname].add(
      entry.queue,
      {},
      { repeat: { pattern: entry.cron }, jobId: `recurring:${entry.queue}` },
    );
  }
}
