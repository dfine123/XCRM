import { prisma, DriveSourceStatus } from '@xcrm/db';

export type OnboardStep = 1 | 2 | 3 | 4 | 5;

/**
 * Given a model, figure out which step the operator should land on when
 * they resume an incomplete onboarding. Linear and preconditioned — no
 * skipping ahead.
 */
export async function computeResumeStep(modelId: string): Promise<OnboardStep> {
  const [accountCount, driveSourceCount] = await Promise.all([
    prisma.account.count({
      where: { modelId, deletedAt: null },
    }),
    prisma.driveSource.count({
      where: { modelId, status: DriveSourceStatus.ACTIVE },
    }),
  ]);

  if (accountCount === 0) return 3;
  if (driveSourceCount === 0) return 4;
  return 5;
}
