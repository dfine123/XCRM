import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';

// Fallback keeps module import safe during Next.js build (ops enqueues
// via @xcrm/jobs). IORedis defers connect until first command, so the
// fallback never actually dials if enqueue helpers aren't invoked.
const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
});

const defaultOpts: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  },
};

export const QUEUE_NAMES = {
  postGenerator: 'post-generator',
  taskBatchAssembler: 'task-batch-assembler',
  engagementSnapshotter: 'engagement-snapshotter',
  insightComputer: 'insight-computer',
  campComposer: 'camp-composer',
  campAutoActivator: 'camp-auto-activator',
  repostScheduler: 'repost-scheduler',
  assetAutoTagger: 'asset-autotagger',
  driveSync: 'drive-sync',
  runwayComputer: 'runway-computer',
  retentionRiskComputer: 'retention-risk-computer',
  contentRequestGenerator: 'content-request-generator',
  followerSnapshotter: 'follower-snapshotter',
  peakHourComputer: 'peak-hour-computer',
  staleInsightRetirer: 'stale-insight-retirer',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const queues: Record<QueueName, Queue> = Object.fromEntries(
  Object.values(QUEUE_NAMES).map((name) => [name, new Queue(name, defaultOpts)]),
) as Record<QueueName, Queue>;
