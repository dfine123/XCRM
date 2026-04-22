-- Partial unique indexes for soft-deletable rows + DriveSource status enum.
--
-- Background: unconditional UNIQUE indexes on (email), (slug), (handle) etc.
-- on models with a `deletedAt` column lock the value even after soft-delete,
-- so the operator can't recreate an Account with a handle that previously
-- existed and got removed. Same bug blocks reconnecting a Drive folder that
-- was disconnected. Fix: replace with partial unique indexes filtered to
-- `deletedAt IS NULL` so soft-deleted rows no longer occupy the namespace.
--
-- The partial indexes use `_active_key` names to make clear they're not
-- managed by Prisma's declarative `@unique` (which would emit a _key suffix
-- without the qualifier). The schema.prisma side declares these columns as
-- plain fields + `@@index` for lookup perf; the partial unique constraint
-- is enforced purely by this raw SQL.
--
-- DriveSource gets a different fix: it moves off soft-delete entirely to an
-- explicit `status` enum (ACTIVE | DISCONNECTED). The row persists for audit
-- trail on disconnect; reconnect flips status back to ACTIVE. That also
-- means the existing unconditional unique on (modelId, folderId) stays
-- unconditional — we never insert duplicates because reconnect reactivates.

-- -----------------------------------------------------------------------------
-- User.email
-- -----------------------------------------------------------------------------
DROP INDEX "User_email_key";
CREATE UNIQUE INDEX "User_email_active_key" ON "User"("email") WHERE "deletedAt" IS NULL;
CREATE INDEX "User_email_idx" ON "User"("email");

-- -----------------------------------------------------------------------------
-- AgencyUser.email
-- -----------------------------------------------------------------------------
DROP INDEX "AgencyUser_email_key";
CREATE UNIQUE INDEX "AgencyUser_email_active_key" ON "AgencyUser"("email") WHERE "deletedAt" IS NULL;
CREATE INDEX "AgencyUser_email_idx" ON "AgencyUser"("email");

-- -----------------------------------------------------------------------------
-- Agency.slug
-- -----------------------------------------------------------------------------
DROP INDEX "Agency_slug_key";
CREATE UNIQUE INDEX "Agency_slug_active_key" ON "Agency"("slug") WHERE "deletedAt" IS NULL;
CREATE INDEX "Agency_slug_idx" ON "Agency"("slug");

-- -----------------------------------------------------------------------------
-- Account.handle + Account.platformAccountId
-- -----------------------------------------------------------------------------
DROP INDEX "Account_handle_key";
CREATE UNIQUE INDEX "Account_handle_active_key" ON "Account"("handle") WHERE "deletedAt" IS NULL;
CREATE INDEX "Account_handle_idx" ON "Account"("handle");

DROP INDEX "Account_platformAccountId_key";
CREATE UNIQUE INDEX "Account_platformAccountId_active_key" ON "Account"("platformAccountId") WHERE "deletedAt" IS NULL;
CREATE INDEX "Account_platformAccountId_idx" ON "Account"("platformAccountId");

-- -----------------------------------------------------------------------------
-- Post.platformPostId
-- -----------------------------------------------------------------------------
DROP INDEX "Post_platformPostId_key";
CREATE UNIQUE INDEX "Post_platformPostId_active_key" ON "Post"("platformPostId") WHERE "deletedAt" IS NULL;
CREATE INDEX "Post_platformPostId_idx" ON "Post"("platformPostId");

-- -----------------------------------------------------------------------------
-- DriveSource: status enum, drop isActive + deletedAt.
-- -----------------------------------------------------------------------------
CREATE TYPE "DriveSourceStatus" AS ENUM ('ACTIVE', 'DISCONNECTED');

ALTER TABLE "DriveSource" ADD COLUMN "status" "DriveSourceStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "DriveSource" ADD COLUMN "disconnectedAt" TIMESTAMP(3);

-- Any row that was inactive OR soft-deleted under the old model is now
-- DISCONNECTED. Capture the disconnect time from deletedAt where known,
-- otherwise fall back to updatedAt.
UPDATE "DriveSource"
   SET "status" = 'DISCONNECTED',
       "disconnectedAt" = COALESCE("deletedAt", "updatedAt")
 WHERE "isActive" = false OR "deletedAt" IS NOT NULL;

DROP INDEX "DriveSource_modelId_isActive_idx";
CREATE INDEX "DriveSource_modelId_status_idx" ON "DriveSource"("modelId", "status");

ALTER TABLE "DriveSource" DROP COLUMN "isActive";
ALTER TABLE "DriveSource" DROP COLUMN "deletedAt";
