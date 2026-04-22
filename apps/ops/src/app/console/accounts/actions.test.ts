import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  account: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
};

const revalidatePathMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock('@xcrm/db', () => ({
  prisma: prismaMock,
  AccountStatus: { FRESH_BUILD: 'FRESH_BUILD', ACTIVE_RAMPING: 'ACTIVE_RAMPING' },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/lib/session', () => ({
  requireUser: vi.fn(async () => ({
    id: 'u-1',
    email: 'test@x.com',
    name: 'Test',
    role: 'FOUNDER',
  })),
}));
vi.mock('@/services/account-status', () => ({
  transitionAccountStatus: vi.fn(),
}));
vi.mock('@xcrm/shared', () => ({
  StateMachines: {
    InvalidStatusTransitionError: class {},
    ACCOUNT_STATUS_TRANSITIONS: {},
  },
}));

beforeEach(() => {
  prismaMock.account.findFirst.mockReset();
  prismaMock.account.update.mockReset();
  prismaMock.account.create.mockReset();
  revalidatePathMock.mockReset();
  redirectMock.mockClear();
});

describe('softDeleteAccount — bug #2 regression', () => {
  it('marks the account deletedAt (freeing the handle)', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: 'a-1',
      modelId: 'm-1',
    });
    prismaMock.account.update.mockResolvedValue({});

    const { softDeleteAccount } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'a-1');
    await softDeleteAccount(fd);

    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: 'a-1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/console/models/m-1`);
  });

  it('is a no-op when the account is already soft-deleted', async () => {
    prismaMock.account.findFirst.mockResolvedValue(null);

    const { softDeleteAccount } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'a-1');
    await softDeleteAccount(fd);

    expect(prismaMock.account.update).not.toHaveBeenCalled();
  });

  it('honors redirectTo when it points inside /console/', async () => {
    prismaMock.account.findFirst.mockResolvedValue({ id: 'a-1', modelId: 'm-1' });
    prismaMock.account.update.mockResolvedValue({});

    const { softDeleteAccount } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'a-1');
    fd.set('redirectTo', '/console/models/m-1');

    // redirectMock throws — we expect that side-effect as the path signal
    await expect(softDeleteAccount(fd)).rejects.toThrow(
      'REDIRECT:/console/models/m-1',
    );
  });

  it('ignores redirectTo outside /console/ (no open-redirect)', async () => {
    prismaMock.account.findFirst.mockResolvedValue({ id: 'a-1', modelId: 'm-1' });
    prismaMock.account.update.mockResolvedValue({});

    const { softDeleteAccount } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'a-1');
    fd.set('redirectTo', 'https://evil.example.com');

    await softDeleteAccount(fd);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
