import {
  prisma,
  AccountStatus,
  DriveSourceStatus,
  DriveSyncStatus,
  PostStatus,
} from '@xcrm/db';
import {
  contentRunwayState,
  escalatedTasksState,
  failedSyncsState,
  quarantinedAccountsState,
  incompleteOnboardingState,
  reviewQueueState,
  rowSeverity,
  compareRosterRows,
  type SignalLightState,
  type Severity,
} from '@/lib/signal-lights';

/**
 * Default daily post cadence per account. Used to compute runway days
 * from `scheduled posts in next 14 days / (accounts * cadence)`.
 * Tunable — we'll make this per-formula in Build G once engagement
 * data drives cadence choices.
 */
const DEFAULT_CADENCE_PER_DAY = 3;

export type RosterAccount = {
  id: string;
  handle: string;
  status: AccountStatus;
  followerCount: number;
};

export type RosterRow = {
  id: string;
  displayName: string;
  archetype: string;
  agency: { id: string; name: string; slug: string };
  accounts: RosterAccount[];
  onboardingCompletedAt: Date | null;
  lastActivity: Date;
  signals: {
    runway: SignalLightState;
    escalated: SignalLightState;
    failedSyncs: SignalLightState;
    quarantined: SignalLightState;
    /** 'YELLOW' when onboarding incomplete, null when complete (no pill). */
    onboarding: 'YELLOW' | null;
    reviewQueue: SignalLightState;
    /** Review queue count, rendered alongside the NEUTRAL pill. Null when STUB. */
    reviewQueueCount: number | null;
  };
  severity: Severity;
};

/**
 * Load every non-deleted model with the data the Roster row needs to
 * compute its signal lights.
 *
 * Pull model + accounts + 24h of sync history in one query. The caller
 * then sorts via `compareRosterRows` (red → yellow → green, alpha
 * within).
 */
export async function getRosterModels(): Promise<RosterRow[]> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const models = await prisma.model.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      displayName: true,
      archetype: true,
      onboardingCompletedAt: true,
      createdAt: true,
      updatedAt: true,
      agency: { select: { id: true, name: true, slug: true } },
      accounts: {
        where: { deletedAt: null },
        select: {
          id: true,
          handle: true,
          status: true,
          followerCount: true,
          updatedAt: true,
        },
      },
      driveSources: {
        where: { status: DriveSourceStatus.ACTIVE },
        select: {
          id: true,
          syncs: {
            where: { startedAt: { gte: twentyFourHoursAgo } },
            orderBy: { startedAt: 'desc' },
            select: { status: true, startedAt: true },
          },
          // Tail for consecutive-failure detection: the most recent few,
          // independent of the 24h window, so a chain spanning days
          // still trips RED.
        },
      },
    },
    orderBy: { displayName: 'asc' },
  });

  // Separate query for the consecutive-failure check: we only care
  // about the most recent 5 sync results per source across ALL time,
  // which is cheap because of the `(driveSourceId, startedAt desc)`
  // index.
  const sourceIds = models.flatMap((m) => m.driveSources.map((ds) => ds.id));
  const recentTail = sourceIds.length
    ? await prisma.driveSync.findMany({
        where: { driveSourceId: { in: sourceIds } },
        orderBy: [{ driveSourceId: 'asc' }, { startedAt: 'desc' }],
        select: { driveSourceId: true, status: true },
        // up to ~5 per source × N sources. For Phase-0 volumes this is
        // tiny; revisit when it isn't.
        take: sourceIds.length * 5,
      })
    : [];
  const tailBySource = new Map<string, DriveSyncStatus[]>();
  for (const row of recentTail) {
    const list = tailBySource.get(row.driveSourceId) ?? [];
    if (list.length < 5) {
      list.push(row.status);
      tailBySource.set(row.driveSourceId, list);
    }
  }

  // Post counts for runway + review-queue signals. One grouped query
  // keyed by accountId → we map back to models via the accounts list.
  const accountIds = models.flatMap((m) => m.accounts.map((a) => a.id));
  const postCounts = accountIds.length
    ? await prisma.post.groupBy({
        by: ['accountId', 'status'],
        where: {
          accountId: { in: accountIds },
          deletedAt: null,
          OR: [
            {
              status: PostStatus.SCHEDULED,
              scheduledFor: { gte: now, lte: fourteenDaysFromNow },
            },
            { status: PostStatus.PENDING_APPROVAL },
          ],
        },
        _count: { _all: true },
      })
    : [];
  const scheduledByAccount = new Map<string, number>();
  const pendingByAccount = new Map<string, number>();
  for (const row of postCounts) {
    if (row.status === PostStatus.SCHEDULED) {
      scheduledByAccount.set(
        row.accountId,
        (scheduledByAccount.get(row.accountId) ?? 0) + row._count._all,
      );
    } else if (row.status === PostStatus.PENDING_APPROVAL) {
      pendingByAccount.set(
        row.accountId,
        (pendingByAccount.get(row.accountId) ?? 0) + row._count._all,
      );
    }
  }

  const rows: RosterRow[] = models.map((m) => {
    // Fold drive-source sync info across all this model's sources.
    let failedInLast24h = 0;
    let consecutiveFailuresMostRecent = 0;
    for (const ds of m.driveSources) {
      failedInLast24h += ds.syncs.filter(
        (s) => s.status === DriveSyncStatus.FAILED,
      ).length;
      const tail = tailBySource.get(ds.id) ?? [];
      let streak = 0;
      for (const status of tail) {
        if (status === DriveSyncStatus.FAILED) streak++;
        else break;
      }
      if (streak > consecutiveFailuresMostRecent) {
        consecutiveFailuresMostRecent = streak;
      }
    }

    const quarantinedCount = m.accounts.filter(
      (a) => a.status === AccountStatus.QUARANTINED,
    ).length;

    // Runway: scheduled-in-next-14d / (accounts × cadence). No accounts
    // → can't compute → STUB (fall back to null).
    let scheduledIn14d = 0;
    let pendingApprovalCount = 0;
    for (const a of m.accounts) {
      scheduledIn14d += scheduledByAccount.get(a.id) ?? 0;
      pendingApprovalCount += pendingByAccount.get(a.id) ?? 0;
    }
    const runwayDays =
      m.accounts.length > 0
        ? scheduledIn14d / (m.accounts.length * DEFAULT_CADENCE_PER_DAY)
        : null;

    const runway = contentRunwayState(runwayDays);
    const escalated = escalatedTasksState(null); // STUB pre-Build F
    const failedSyncs = failedSyncsState({
      failedInLast24h,
      consecutiveFailuresMostRecent,
    });
    const quarantined = quarantinedAccountsState(quarantinedCount);
    const onboarding = incompleteOnboardingState(m.onboardingCompletedAt);
    // Review queue renders NEUTRAL with the count when > 0, STUB
    // otherwise. Keeps the roster clean on day-1 when no posts exist.
    const reviewQueue = reviewQueueState(
      pendingApprovalCount > 0 ? pendingApprovalCount : null,
    );

    const signalStates: SignalLightState[] = [
      runway,
      escalated,
      failedSyncs,
      quarantined,
      reviewQueue,
    ];
    if (onboarding === 'YELLOW') signalStates.push('YELLOW');
    const severity = rowSeverity(signalStates);

    const accountLatest = m.accounts.reduce(
      (max, a) => (a.updatedAt > max ? a.updatedAt : max),
      m.updatedAt,
    );
    const lastActivity = accountLatest > m.createdAt ? accountLatest : m.createdAt;

    return {
      id: m.id,
      displayName: m.displayName,
      archetype: m.archetype,
      agency: m.agency,
      accounts: m.accounts.map((a) => ({
        id: a.id,
        handle: a.handle,
        status: a.status,
        followerCount: a.followerCount,
      })),
      onboardingCompletedAt: m.onboardingCompletedAt,
      lastActivity,
      signals: {
        runway,
        escalated,
        failedSyncs,
        quarantined,
        onboarding,
        reviewQueue,
        reviewQueueCount: pendingApprovalCount > 0 ? pendingApprovalCount : null,
      },
      severity,
    };
  });

  return rows.sort(compareRosterRows);
}
