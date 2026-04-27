import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  camp: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  campMembership: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  account: {
    findFirst: vi.fn(),
  },
};

const revalidatePathMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock('@xcrm/db', () => ({
  prisma: prismaMock,
  CampStatus: {
    PROPOSED: 'PROPOSED',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/lib/session', () => ({
  requireUser: vi.fn(async () => ({
    id: 'u-1',
    email: 'op@x.com',
    name: 'Op',
    role: 'FOUNDER',
  })),
}));

beforeEach(() => {
  for (const k of Object.keys(prismaMock) as (keyof typeof prismaMock)[]) {
    const obj = prismaMock[k] as Record<string, ReturnType<typeof vi.fn>>;
    for (const m of Object.values(obj)) m.mockReset();
  }
  revalidatePathMock.mockReset();
  redirectMock.mockClear();
});

describe('createCamp', () => {
  it('creates PROPOSED + redirects to detail', async () => {
    prismaMock.camp.create.mockResolvedValue({ id: 'c-1' });
    const { createCamp } = await import('./actions');
    const fd = new FormData();
    fd.set('weekOf', '2026-04-26');
    await expect(createCamp(null, fd)).rejects.toThrow('REDIRECT:/console/camps/c-1');
    const arg = prismaMock.camp.create.mock.calls[0]![0];
    expect(arg.data.status).toBe('PROPOSED');
    expect(arg.data.createdByAlgorithm).toBe(false);
  });

  it('rejects malformed weekOf', async () => {
    const { createCamp } = await import('./actions');
    const fd = new FormData();
    fd.set('weekOf', 'tomorrow');
    const res = await createCamp(null, fd);
    expect(res?.error).toBeDefined();
    expect(prismaMock.camp.create).not.toHaveBeenCalled();
  });
});

describe('activateCamp', () => {
  it('PROPOSED → ACTIVE with approvedByUserId', async () => {
    prismaMock.camp.findUnique.mockResolvedValue({ status: 'PROPOSED' });
    prismaMock.camp.update.mockResolvedValue({});
    const { activateCamp } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'c-1');
    await activateCamp(fd);
    const arg = prismaMock.camp.update.mock.calls[0]![0];
    expect(arg.data.status).toBe('ACTIVE');
    expect(arg.data.approvedByUserId).toBe('u-1');
    expect(arg.data.approvedAt).toBeInstanceOf(Date);
  });

  it('no-op when not PROPOSED', async () => {
    prismaMock.camp.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    const { activateCamp } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'c-1');
    await activateCamp(fd);
    expect(prismaMock.camp.update).not.toHaveBeenCalled();
  });
});

describe('completeCamp', () => {
  it('ACTIVE → COMPLETED', async () => {
    prismaMock.camp.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    prismaMock.camp.update.mockResolvedValue({});
    const { completeCamp } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'c-1');
    await completeCamp(fd);
    expect(prismaMock.camp.update.mock.calls[0]![0].data.status).toBe('COMPLETED');
  });
});

describe('addAccountToCamp', () => {
  it('resolves @handle to accountId and creates membership', async () => {
    prismaMock.account.findFirst.mockResolvedValue({ id: 'a-1' });
    prismaMock.campMembership.create.mockResolvedValue({});
    const { addAccountToCamp } = await import('./actions');
    const fd = new FormData();
    fd.set('campId', 'c-1');
    fd.set('handle', '@target');
    const res = await addAccountToCamp(null, fd);
    expect(res?.ok).toBe(true);
    expect(prismaMock.account.findFirst.mock.calls[0]![0].where.handle).toBe('target');
    expect(prismaMock.campMembership.create.mock.calls[0]![0].data).toEqual({
      campId: 'c-1',
      accountId: 'a-1',
    });
  });

  it('returns error when handle does not exist', async () => {
    prismaMock.account.findFirst.mockResolvedValue(null);
    const { addAccountToCamp } = await import('./actions');
    const fd = new FormData();
    fd.set('campId', 'c-1');
    fd.set('handle', 'ghost');
    const res = await addAccountToCamp(null, fd);
    expect(res?.error).toMatch(/no active account/i);
    expect(prismaMock.campMembership.create).not.toHaveBeenCalled();
  });

  it('treats P2002 (already a member) as success', async () => {
    prismaMock.account.findFirst.mockResolvedValue({ id: 'a-1' });
    prismaMock.campMembership.create.mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'P2002' }),
    );
    const { addAccountToCamp } = await import('./actions');
    const fd = new FormData();
    fd.set('campId', 'c-1');
    fd.set('handle', 'dup');
    const res = await addAccountToCamp(null, fd);
    expect(res?.ok).toBe(true);
  });
});

describe('removeAccountFromCamp', () => {
  it('deletes by membership id and revalidates', async () => {
    prismaMock.campMembership.findUnique.mockResolvedValue({ campId: 'c-1' });
    prismaMock.campMembership.delete.mockResolvedValue({});
    const { removeAccountFromCamp } = await import('./actions');
    const fd = new FormData();
    fd.set('membershipId', 'm-1');
    await removeAccountFromCamp(fd);
    expect(prismaMock.campMembership.delete.mock.calls[0]![0].where.id).toBe('m-1');
    expect(revalidatePathMock).toHaveBeenCalledWith('/console/camps/c-1');
  });

  it('no-op when membership does not exist', async () => {
    prismaMock.campMembership.findUnique.mockResolvedValue(null);
    const { removeAccountFromCamp } = await import('./actions');
    const fd = new FormData();
    fd.set('membershipId', 'm-x');
    await removeAccountFromCamp(fd);
    expect(prismaMock.campMembership.delete).not.toHaveBeenCalled();
  });
});
