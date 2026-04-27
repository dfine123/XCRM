import { prisma, PostStatus, type AccountStatus } from '@xcrm/db';
import { draftPost, AiDraftError } from '@xcrm/ai';
import type { Prompts } from '@xcrm/shared';
import {
  isGenerationEligible,
  routePostStatus,
} from '@/lib/confidence-routing';
import { pickScheduledTime } from '@/lib/post-scheduler';
import { loadCandidateAssets } from '@/app/console/_loaders/candidate-assets';
import { loadEngagementSamplesForAccount } from '@/app/console/_loaders/engagement-samples';
import { summariseEngagement } from '@/lib/engagement-aggregation';
import {
  getActiveNotes,
  filterNotesForModel,
} from '@/app/console/_loaders/active-notes';

export type GenerateDraftOutcome =
  | { kind: 'SKIPPED'; reason: string }
  | { kind: 'NO_SLOT' }
  | { kind: 'LLM_ERROR'; error: string }
  | {
      kind: 'CREATED';
      postId: string;
      status: 'PENDING_APPROVAL' | 'SCHEDULED';
      confidence: number;
      assetId: string;
      scheduledFor: Date;
    };

export type GenerateDraftOpts = {
  /** Optional: overrides Date.now() for deterministic scheduler tests. */
  now?: Date;
  /** Optional: attribute the draft to a specific operator (manual trigger). */
  triggeredByUserId?: string;
};

/**
 * Build D orchestrator. Owns: eligibility gate, context assembly,
 * LLM call, confidence routing, scheduler call, DB write. One draft
 * per call — the cron fans this out across eligible accounts.
 *
 * Returns a discriminated outcome rather than throwing so the caller
 * (cron endpoint or API route) can render per-account status.
 */
export async function generateDraftForAccount(
  accountId: string,
  opts: GenerateDraftOpts = {},
): Promise<GenerateDraftOutcome> {
  const now = opts.now ?? new Date();

  const account = await prisma.account.findFirst({
    where: { id: accountId, deletedAt: null },
    include: {
      model: {
        select: {
          id: true,
          displayName: true,
          archetype: true,
          voiceToneNotes: true,
          hardRules: true,
          softPreferences: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!account) return { kind: 'SKIPPED', reason: 'account not found' };
  if (account.model.deletedAt) {
    return { kind: 'SKIPPED', reason: 'model is deleted' };
  }
  if (!isGenerationEligible(account.status as AccountStatus)) {
    return {
      kind: 'SKIPPED',
      reason: `account status ${account.status} is not generation-eligible`,
    };
  }

  // Scheduler must have a slot before we spend an LLM call.
  const existing = await prisma.post.findMany({
    where: {
      accountId,
      deletedAt: null,
      status: {
        in: [
          PostStatus.PENDING_APPROVAL,
          PostStatus.APPROVED,
          PostStatus.SCHEDULED,
        ],
      },
      scheduledFor: { not: null },
    },
    select: { scheduledFor: true },
  });
  const scheduledFor = pickScheduledTime({
    peakHours: account.peakHours,
    existingScheduled: existing
      .map((e) => e.scheduledFor)
      .filter((d): d is Date => d !== null),
    now,
  });
  if (!scheduledFor) return { kind: 'NO_SLOT' };

  // Context assembly.
  const [assets, activeNotes, engagementSamples] = await Promise.all([
    loadCandidateAssets(accountId),
    getActiveNotes(),
    loadEngagementSamplesForAccount(accountId),
  ]);
  const scopedNotes = filterNotesForModel(activeNotes, {
    archetype: account.model.archetype,
    accountIds: [account.id],
  });
  const engagementSummary = summariseEngagement(engagementSamples);

  const promptInput: Prompts.DraftPromptInput = {
    model: {
      displayName: account.model.displayName,
      archetype: account.model.archetype,
      voiceToneNotes: account.model.voiceToneNotes,
      hardRules: arrayOfStrings(account.model.hardRules),
      softPreferences: arrayOfStrings(account.model.softPreferences),
    },
    account: {
      handle: account.handle,
      status: account.status,
      followerCount: account.followerCount,
    },
    activeNotes: scopedNotes.map((n) => ({
      title: n.title,
      body: n.body,
      weight: n.weight,
    })),
    assets,
    engagement:
      engagementSummary.sampleCount > 0
        ? {
            sampleCount: engagementSummary.sampleCount,
            topAesthetics: engagementSummary.topAesthetics.map((f) => ({
              key: f.key,
              avgRate: f.avgRate,
            })),
            topMoods: engagementSummary.topMoods.map((f) => ({
              key: f.key,
              avgRate: f.avgRate,
            })),
            topLightings: engagementSummary.topLightings.map((f) => ({
              key: f.key,
              avgRate: f.avgRate,
            })),
            peakHoursUtc: engagementSummary.peakHoursUtc,
          }
        : undefined,
  };

  console.log(
    `[gen] draft start accountId=${accountId} handle=@${account.handle} status=${account.status} pool=${assets.length} notes=${scopedNotes.length} engagement=${engagementSummary.sampleCount}`,
  );

  let draft;
  try {
    draft = await draftPost(promptInput);
  } catch (err) {
    const message =
      err instanceof AiDraftError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error(`[gen] LLM error accountId=${accountId}:`, message);
    return { kind: 'LLM_ERROR', error: message };
  }

  // If Claude returned confidence 0 (usually "no fit / hard rules can't
  // be satisfied"), don't write a zero-value row. Record it as a
  // SKIPPED outcome so the cron log shows why nothing materialised.
  if (draft.confidence === 0) {
    console.log(
      `[gen] confidence=0 from LLM — skipping write. reasoning: ${draft.reasoning.slice(0, 160)}`,
    );
    return {
      kind: 'SKIPPED',
      reason: `confidence 0: ${draft.reasoning.slice(0, 120)}`,
    };
  }

  const postStatus = routePostStatus(
    account.status as AccountStatus,
    draft.confidence,
  );

  const post = await prisma.post.create({
    data: {
      accountId,
      status: postStatus,
      copy: draft.copy,
      assetIds: [draft.assetId],
      scheduledFor,
      confidenceScore: draft.confidence,
      generatedByUserId: opts.triggeredByUserId ?? null,
      generationMeta: {
        reasoning: draft.reasoning,
        generatedAt: now.toISOString(),
        source: opts.triggeredByUserId ? 'manual' : 'cron',
        poolSize: assets.length,
        activeNoteTitles: scopedNotes.map((n) => n.title),
      },
    },
    select: { id: true },
  });

  console.log(
    `[gen] draft saved postId=${post.id} status=${postStatus} confidence=${draft.confidence.toFixed(2)} scheduledFor=${scheduledFor.toISOString()}`,
  );

  return {
    kind: 'CREATED',
    postId: post.id,
    status: postStatus as 'PENDING_APPROVAL' | 'SCHEDULED',
    confidence: draft.confidence,
    assetId: draft.assetId,
    scheduledFor,
  };
}

/**
 * Fan-out for the cron endpoint. Iterates every generation-eligible
 * account and runs the orchestrator once per. Errors are logged per
 * account; one failure does not abort the batch.
 */
export async function runScheduledGeneration(): Promise<{
  accountsRun: number;
  created: number;
  skipped: number;
  errors: number;
  noSlot: number;
}> {
  const accounts = await prisma.account.findMany({
    where: {
      deletedAt: null,
      status: {
        in: [
          // Mirrors confidence-routing.GENERATION_ELIGIBLE_STATUSES —
          // listed here as literals so the Prisma filter is narrow.
          'FRESH_BUILD',
          'ACTIVE_RAMPING',
          'ACTIVE_ESTABLISHED',
          'ACTIVE_MATURE',
        ],
      },
      model: { deletedAt: null, onboardingCompletedAt: { not: null } },
    },
    select: { id: true },
  });

  console.log(`[gen:cron] fan-out for ${accounts.length} eligible accounts`);

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let noSlot = 0;
  for (const a of accounts) {
    try {
      const out = await generateDraftForAccount(a.id);
      switch (out.kind) {
        case 'CREATED':
          created++;
          break;
        case 'SKIPPED':
          skipped++;
          break;
        case 'NO_SLOT':
          noSlot++;
          break;
        case 'LLM_ERROR':
          errors++;
          break;
      }
    } catch (err) {
      errors++;
      console.error(
        `[gen:cron] unhandled accountId=${a.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return {
    accountsRun: accounts.length,
    created,
    skipped,
    errors,
    noSlot,
  };
}

function arrayOfStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}
