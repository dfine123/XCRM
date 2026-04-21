import { Worker, type Processor } from 'bullmq';
import pino from 'pino';
import { connection, QUEUE_NAMES, type QueueName } from './queues';
import { registerRecurringJobs } from './schedule';
import { driveSyncHandler } from './handlers/drive-sync';
import { assetAutoTaggerHandler } from './handlers/asset-auto-tagger';

const log = pino({ name: 'xcrm-worker', level: process.env.LOG_LEVEL ?? 'info' });

const stubHandler: Processor = async (job) => {
  log.info({ queue: job.queueName, jobId: job.id }, 'job received (stub handler)');
  return { ok: true, stub: true };
};

const HANDLERS: Record<QueueName, Processor> = {
  [QUEUE_NAMES.driveSync]: driveSyncHandler,
  [QUEUE_NAMES.assetAutoTagger]: assetAutoTaggerHandler,
  // All other queues remain Phase-0 stubs until their feature lands.
  [QUEUE_NAMES.postGenerator]: stubHandler,
  [QUEUE_NAMES.taskBatchAssembler]: stubHandler,
  [QUEUE_NAMES.engagementSnapshotter]: stubHandler,
  [QUEUE_NAMES.insightComputer]: stubHandler,
  [QUEUE_NAMES.campComposer]: stubHandler,
  [QUEUE_NAMES.campAutoActivator]: stubHandler,
  [QUEUE_NAMES.repostScheduler]: stubHandler,
  [QUEUE_NAMES.runwayComputer]: stubHandler,
  [QUEUE_NAMES.retentionRiskComputer]: stubHandler,
  [QUEUE_NAMES.contentRequestGenerator]: stubHandler,
  [QUEUE_NAMES.followerSnapshotter]: stubHandler,
  [QUEUE_NAMES.peakHourComputer]: stubHandler,
  [QUEUE_NAMES.staleInsightRetirer]: stubHandler,
};

const CONCURRENCY: Partial<Record<QueueName, number>> = {
  [QUEUE_NAMES.driveSync]: 2,
  [QUEUE_NAMES.assetAutoTagger]: 4,
};

async function main() {
  log.info('starting xcrm worker');

  for (const queueName of Object.values(QUEUE_NAMES)) {
    const worker = new Worker(queueName, HANDLERS[queueName], {
      connection,
      concurrency: CONCURRENCY[queueName] ?? 2,
    });
    worker.on('failed', (job, err) =>
      log.error({ queue: queueName, jobId: job?.id, err: err.message }, 'job failed'),
    );
  }

  await registerRecurringJobs();
  log.info('recurring jobs registered');
}

main().catch((err) => {
  log.error({ err }, 'worker boot failed');
  process.exit(1);
});
