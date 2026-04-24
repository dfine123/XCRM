import { prisma, AccountStatus, DriveSourceStatus, DriveSyncStatus } from '@xcrm/db';
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
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

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

    const runway = contentRunwayState(null); // STUB pre-Build D
    const escalated = escalatedTasksState(null); // STUB pre-Build F
    const failedSyncs = failedSyncsState({
      failedInLast24h,
      consecutiveFailuresMostRecent,
    });
    const quarantined = quarantinedAccountsState(quarantinedCount);
    const onboarding = incompleteOnboardingState(m.onboardingCompletedAt);
    const reviewQueue = reviewQueueState(null); // STUB pre-Build E

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
        reviewQueueCount: null,
      },
      severity,
    };
  });

  return rows.sort(compareRosterRows);
}
