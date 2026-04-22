-- Partial unique indexes for soft-deletable rows + DriveSource status enum.
--
-- Background: unconditional UNIQUE indexes on (email), (slug), (handle) etc.
-- on models with a `deletedAt` column lock the value even after soft-delete,
-- so the operator can't recreate an Account with a handle that previously
-- existed and got removed. Same bug blocks reconnecting a Drive folder that
-- was disconnected. Fix: replace the full unique indexes with partial ones
-- filtered to `deletedAt IS NULL` so soft-deleted rows no longer occupy the
-- namespace.
--
-- We REUSE the original index names (`<Model>_<field>_key`) so Prisma's
-- schema view (still declaring `@unique`) and the DB-side constraint name
-- agree. Prisma can't express a partial unique declaratively, so the
-- schema keeps `@unique` (drives findUnique/upsert client API) and this
-- raw SQL narrows the constraint's predicate at the DB layer. Prisma
-- migrate diff compares schema-to-schema, never schema-to-DB, so this
-- divergence is stable.
--
-- DriveSource takes a different path: an explicit status enum (ACTIVE |
-- DISCONNECTED) replaces soft-delete entirely, so reconnect is a row-level
-- state transition that keeps history (DriveSync rows, ContentAssets)
-- attached. The (modelId, folderId) unique stays unconditional — we never
-- insert duplicates because reconnect reactivates.

-- -----------------------------------------------------------------------------
-- User.email
-- -----------------------------------------------------------------------------
DROP INDEX "User_email_key";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email") WHERE "deletedAt" IS NULL;

-- -----------------------------------------------------------------------------
-- AgencyUser.email
-- -----------------------------------------------------------------------------
DROP INDEX "AgencyUser_email_key";
CREATE UNIQUE INDEX "AgencyUser_email_key" ON "AgencyUser"("email") WHERE "deletedAt" IS NULL;

-- -----------------------------------------------------------------------------
-- Agency.slug
-- -----------------------------------------------------------------------------
DROP INDEX "Agency_slug_key";
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug") WHERE "deletedAt" IS NULL;

-- -----------------------------------------------------------------------------
-- Account.handle + Account.platformAccountId
-- -----------------------------------------------------------------------------
DROP INDEX "Account_handle_key";
CREATE UNIQUE INDEX "Account_handle_key" ON "Account"("handle") WHERE "deletedAt" IS NULL;

DROP INDEX "Account_platformAccountId_key";
CREATE UNIQUE INDEX "Account_platformAccountId_key" ON "Account"("platformAccountId") WHERE "deletedAt" IS NULL;

-- -----------------------------------------------------------------------------
-- Post.platformPostId
-- -----------------------------------------------------------------------------
DROP INDEX "Post_platformPostId_key";
CREATE UNIQUE INDEX "Post_platformPostId_key" ON "Post"("platformPostId") WHERE "deletedAt" IS NULL;

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
