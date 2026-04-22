/**
 * Idempotent seed for local dev + first Railway deploy.
 *
 * Runs via `pnpm --filter @xcrm/db db:seed`, and also on every ops
 * container boot (see apps/ops/Dockerfile CMD). Every write is an
 * upsert, so re-running is a no-op.
 *
 * Portal note: AgencyUser has no passwordHash — the portal
 * authenticates by magic link (see apps/portal/src/app/api/auth/consume).
 * This seed creates a long-lived magic link with a known token so the
 * seeded agency owner can sign in without email delivery wired up.
 * Rotate or delete before shipping to real customers.
 */
import {
  PrismaClient,
  UserRole,
  UserStatus,
  AgencyStatus,
  AgencyUserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'ChangeMe123!';
const DEFAULT_AGENCY_MAGIC_TOKEN = 'dev-magic-token-change-me';

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const opsUsers = [
    { email: 'david@xcrm.local', name: 'David', role: UserRole.FOUNDER },
    { email: 'partner@xcrm.local', name: 'Partner', role: UserRole.PARTNER },
    { email: 'va1@xcrm.local', name: 'Test VA', role: UserRole.VA_T1 },
  ];

  for (const u of opsUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      // If a previously-seeded user was soft-deleted, reset deletedAt so the
      // seed is truly idempotent. Partial unique on User.email means a
      // create-branch fallback would also work, but update is cheaper.
      update: {
        name: u.name,
        role: u.role,
        status: UserStatus.ACTIVE,
        passwordHash,
        deletedAt: null,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
    });
  }

  const agency = await prisma.agency.upsert({
    where: { slug: 'test-agency' },
    update: { name: 'Test Agency', status: AgencyStatus.ACTIVE, deletedAt: null },
    create: { name: 'Test Agency', slug: 'test-agency', status: AgencyStatus.ACTIVE },
  });

  const agencyUser = await prisma.agencyUser.upsert({
    where: { email: 'agency@test.local' },
    update: {
      name: 'Agency Owner',
      agencyId: agency.id,
      role: AgencyUserRole.AGENCY_OWNER,
      deletedAt: null,
    },
    create: {
      email: 'agency@test.local',
      name: 'Agency Owner',
      agencyId: agency.id,
      role: AgencyUserRole.AGENCY_OWNER,
    },
  });

  const magicToken = process.env.SEED_AGENCY_MAGIC_TOKEN ?? DEFAULT_AGENCY_MAGIC_TOKEN;
  const tokenHash = crypto.createHash('sha256').update(magicToken).digest('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30d
  await prisma.agencyMagicLink.upsert({
    where: { tokenHash },
    update: { agencyUserId: agencyUser.id, expiresAt, usedAt: null },
    create: { agencyUserId: agencyUser.id, tokenHash, expiresAt },
  });

  console.log('[seed] ok');
  console.log('[seed] ops users (password: %s):', DEFAULT_PASSWORD);
  console.log('[seed]   david@xcrm.local   (FOUNDER)');
  console.log('[seed]   partner@xcrm.local (PARTNER)');
  console.log('[seed]   va1@xcrm.local     (VA_T1)');
  console.log('[seed] portal agency owner: agency@test.local');
  console.log(
    '[seed]   magic-link token: %s (visit /api/auth/consume?t=<token> on the portal host)',
    magicToken,
  );
}

main()
  .catch((e) => {
    console.error('[seed] failed', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
