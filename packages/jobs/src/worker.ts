import { Worker } from 'bullmq';
import pino from 'pino';
import { connection, QUEUE_NAMES } from './queues';
import { registerRecurringJobs } from './schedule';

const log = pino({ name: 'xcrm-worker', level: process.env.LOG_LEVEL ?? 'info' });

async function main() {
  log.info('starting xcrm worker');

  for (const queueName of Object.values(QUEUE_NAMES)) {
    const worker = new Worker(
      queueName,
      async (job) => {
        log.info({ queue: queueName, jobId: job.id }, 'job received (phase 0 stub)');
        // Phase 0: jobs are registered but no-op. Handlers land per-feature.
        return { ok: true, stub: true };
      },
      { connection, concurrency: 2 },
    );
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
