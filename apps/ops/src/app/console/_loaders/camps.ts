import { prisma, CampStatus } from '@xcrm/db';

export type CampListRow = {
  id: string;
  weekOf: Date;
  status: CampStatus;
  memberCount: number;
  createdByAlgorithm: boolean;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};

const STATUS_RANK: Record<CampStatus, number> = {
  ACTIVE: 0,
  PROPOSED: 1,
  COMPLETED: 2,
};

/**
 * All camps with member counts. Sorted ACTIVE → PROPOSED →
 * COMPLETED, then by `weekOf` desc within each group.
 */
export async function getCampList(): Promise<CampListRow[]> {
  const rows = await prisma.camp.findMany({
    include: {
      _count: { select: { memberships: true } },
      approvedBy: { select: { name: true, email: true } },
    },
    orderBy: { weekOf: 'desc' },
  });

  const mapped: CampListRow[] = rows.map((c) => ({
    id: c.id,
    weekOf: c.weekOf,
    status: c.status,
    memberCount: c._count.memberships,
    createdByAlgorithm: c.createdByAlgorithm,
    approvedByName: c.approvedBy?.name ?? c.approvedBy?.email ?? null,
    approvedAt: c.approvedAt,
    createdAt: c.createdAt,
  }));

  mapped.sort((a, b) => {
    const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (r !== 0) return r;
    return b.weekOf.getTime() - a.weekOf.getTime();
  });
  return mapped;
}

export type CampDetail = {
  id: string;
  weekOf: Date;
  status: CampStatus;
  createdByAlgorithm: boolean;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  members: {
    membershipId: string;
    accountId: string;
    handle: string;
    accountStatus: string;
    modelId: string;
    modelDisplayName: string;
    agencySlug: string;
  }[];
};

export async function getCampDetail(id: string): Promise<CampDetail | null> {
  const c = await prisma.camp.findUnique({
    where: { id },
    include: {
      approvedBy: { select: { name: true, email: true } },
      memberships: {
        include: {
          account: {
            select: {
              id: true,
              handle: true,
              status: true,
              model: {
                select: {
                  id: true,
                  displayName: true,
                  agency: { select: { slug: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!c) return null;

  return {
    id: c.id,
    weekOf: c.weekOf,
    status: c.status,
    createdByAlgorithm: c.createdByAlgorithm,
    approvedByName: c.approvedBy?.name ?? c.approvedBy?.email ?? null,
    approvedAt: c.approvedAt,
    createdAt: c.createdAt,
    members: c.memberships.map((m) => ({
      membershipId: m.id,
      accountId: m.account.id,
      handle: m.account.handle,
      accountStatus: m.account.status,
      modelId: m.account.model.id,
      modelDisplayName: m.account.model.displayName,
      agencySlug: m.account.model.agency.slug,
    })),
  };
}

/**
 * Lightweight per-account camp summary for the model-detail Overview
 * block. Returns ACTIVE camps only — historical memberships aren't
 * actionable from there.
 */
export async function getCampsForAccount(
  accountId: string,
): Promise<{ campId: string; weekOf: Date; status: CampStatus; memberCount: number }[]> {
  const memberships = await prisma.campMembership.findMany({
    where: {
      accountId,
      camp: { status: CampStatus.ACTIVE },
    },
    include: {
      camp: {
        include: {
          _count: { select: { memberships: true } },
        },
      },
    },
  });
  return memberships.map((m) => ({
    campId: m.campId,
    weekOf: m.camp.weekOf,
    status: m.camp.status,
    memberCount: m.camp._count.memberships,
  }));
}
