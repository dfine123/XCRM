/**
 * Idempotent seed for local dev + first Railway deploy.
 *
 * Runs via `pnpm --filter @xcrm/db db:seed`, and also on every ops
 * container boot (see apps/ops/Dockerfile CMD). Every write is a
 * findFirst + conditional create/update, so re-running is a no-op.
 *
 * We deliberately avoid Prisma's `upsert({where:{email}})` shape here —
 * soft-deletable fields (email, slug) use partial unique indexes at the
 * DB layer to let operators reuse a value after soft-delete, and the
 * matching schema wiring has historically been fragile around Docker
 * layer caches. Hand-rolling the upsert with findFirst + create/update
 * makes the seed schema-detail-agnostic.
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
    const existing = await prisma.user.findFirst({
      where: { email: u.email },
      select: { id: true },
    });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: u.name,
          role: u.role,
          status: UserStatus.ACTIVE,
          passwordHash,
          deletedAt: null,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          role: u.role,
          status: UserStatus.ACTIVE,
          passwordHash,
        },
      });
    }
  }

  const existingAgency = await prisma.agency.findFirst({
    where: { slug: 'test-agency' },
    select: { id: true },
  });
  const agency = existingAgency
    ? await prisma.agency.update({
        where: { id: existingAgency.id },
        data: {
          name: 'Test Agency',
          status: AgencyStatus.ACTIVE,
          deletedAt: null,
        },
      })
    : await prisma.agency.create({
        data: {
          name: 'Test Agency',
          slug: 'test-agency',
          status: AgencyStatus.ACTIVE,
        },
      });

  const existingAgencyUser = await prisma.agencyUser.findFirst({
    where: { email: 'agency@test.local' },
    select: { id: true },
  });
  const agencyUser = existingAgencyUser
    ? await prisma.agencyUser.update({
        where: { id: existingAgencyUser.id },
        data: {
          name: 'Agency Owner',
          agencyId: agency.id,
          role: AgencyUserRole.AGENCY_OWNER,
          deletedAt: null,
        },
      })
    : await prisma.agencyUser.create({
        data: {
          email: 'agency@test.local',
          name: 'Agency Owner',
          agencyId: agency.id,
          role: AgencyUserRole.AGENCY_OWNER,
        },
      });

  const magicToken =
    process.env.SEED_AGENCY_MAGIC_TOKEN ?? DEFAULT_AGENCY_MAGIC_TOKEN;
  const tokenHash = crypto.createHash('sha256').update(magicToken).digest('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30d
  // AgencyMagicLink.tokenHash stays @unique unconditionally — no soft-delete
  // on this entity — so keeping upsert here is fine.
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
