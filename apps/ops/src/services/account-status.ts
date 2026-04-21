import { prisma, AccountStatus } from '@xcrm/db';
import { StateMachines } from '@xcrm/shared';

/**
 * Move an account to a new status, atomically logging the transition.
 * Rejects invalid transitions per the state machine — server enforces,
 * UI only hides invalid buttons as a hint.
 */
export async function transitionAccountStatus({
  accountId,
  toStatus,
  actorId,
  reason,
}: {
  accountId: string;
  toStatus: AccountStatus;
  actorId: string;
  reason?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findUnique({
      where: { id: accountId },
      select: { id: true, status: true },
    });
    if (!account) throw new Error(`Account ${accountId} not found`);
    if (account.status === toStatus) return account;

    if (!StateMachines.canTransition(account.status, toStatus)) {
      throw new StateMachines.InvalidStatusTransitionError(account.status, toStatus);
    }

    await tx.statusTransition.create({
      data: {
        accountId,
        fromStatus: account.status,
        toStatus,
        actorId,
        reason: reason ?? '',
      },
    });

    return tx.account.update({
      where: { id: accountId },
      data: { status: toStatus, statusChangedAt: new Date() },
    });
  });
}
