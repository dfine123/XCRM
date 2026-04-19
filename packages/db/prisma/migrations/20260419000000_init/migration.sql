-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FOUNDER', 'PARTNER', 'VA_T1', 'VA_T2', 'VA_T3');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'OFFBOARDED');

-- CreateEnum
CREATE TYPE "AgencyUserRole" AS ENUM ('AGENCY_OWNER', 'AGENCY_STAFF');

-- CreateEnum
CREATE TYPE "AgencyStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'PAUSED', 'CHURNED');

-- CreateEnum
CREATE TYPE "ContractTier" AS ENUM ('FLAT', 'FLAT_PLUS_PERF', 'CAMP_SLOT');

-- CreateEnum
CREATE TYPE "Archetype" AS ENUM ('BLONDE_THIRST', 'ALT_GOTH', 'GYM_GIRL', 'LATINA', 'ASIAN', 'REDHEAD', 'MILF', 'TEEN_LOOK', 'EBONY', 'OTHER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PROSPECT', 'FRESH_BUILD', 'ACQUIRED_AGED', 'ACQUIRED_IN_NICHE', 'TAKEOVER', 'ACTIVE_RAMPING', 'ACTIVE_ESTABLISHED', 'ACTIVE_MATURE', 'PAUSED', 'OFFBOARDING', 'ARCHIVED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "PhoneDeviceStatus" AS ENUM ('ACTIVE', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('PHOTO', 'VIDEO', 'GIF');

-- CreateEnum
CREATE TYPE "AssetTagStatus" AS ENUM ('PENDING', 'TAGGED', 'FAILED');

-- CreateEnum
CREATE TYPE "FormulaStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'POSTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReplyStatus" AS ENUM ('DRAFT', 'APPROVED', 'SCHEDULED', 'POSTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RepostStatus" AS ENUM ('SCHEDULED', 'POSTED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ContextNoteStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InsightKind" AS ENUM ('FORMAT_PERFORMANCE', 'ASSET_TYPE', 'TIME_SLOT', 'ARCHETYPE_CORRELATION', 'OTHER');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'DEMOTED', 'STALE');

-- CreateEnum
CREATE TYPE "TaskBatchKind" AS ENUM ('WARMUP', 'REPLY', 'POST_DROP', 'REPOST', 'COMMENT_TRIAGE', 'MIXED');

-- CreateEnum
CREATE TYPE "TaskBatchStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TaskAction" AS ENUM ('WARMUP_POST', 'POST', 'REPLY', 'REPOST', 'COMMENT_RESPONSE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'ESCALATED', 'FAILED');

-- CreateEnum
CREATE TYPE "QualityVerdict" AS ENUM ('PASS', 'MINOR_DEVIATION', 'MAJOR_DEVIATION');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "accuracyScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "role" "AgencyUserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AgencyUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyMagicLink" (
    "id" TEXT NOT NULL,
    "agencyUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyMagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencySession" (
    "id" TEXT NOT NULL,
    "agencyUserId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "AgencyStatus" NOT NULL DEFAULT 'PROSPECT',
    "retentionRiskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "tier" "ContractTier" NOT NULL,
    "accountSlots" INTEGER NOT NULL,
    "monthlyRate" DECIMAL(10,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "archetype" "Archetype" NOT NULL,
    "voiceToneNotes" TEXT NOT NULL,
    "hardRules" JSONB NOT NULL DEFAULT '[]',
    "softPreferences" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "platformAccountId" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'PROSPECT',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "phoneDeviceId" TEXT,
    "peakHours" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneDevice" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "PhoneDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountFollowerSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "followerCount" INTEGER NOT NULL,
    "followingCount" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountFollowerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusTransition" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fromStatus" "AccountStatus" NOT NULL,
    "toStatus" "AccountStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAsset" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "uploadedByAgencyUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoTags" JSONB NOT NULL DEFAULT '{}',
    "manualTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclusiveToAccountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tagStatus" "AssetTagStatus" NOT NULL DEFAULT 'PENDING',
    "lastUsedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetUsage" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "postId" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentFormula" (
    "id" TEXT NOT NULL,
    "version" SERIAL NOT NULL,
    "status" "FormulaStatus" NOT NULL DEFAULT 'DRAFT',
    "appliesTo" JSONB NOT NULL,
    "hookPatterns" JSONB NOT NULL DEFAULT '[]',
    "baitArchetypes" JSONB NOT NULL DEFAULT '[]',
    "assetPairingRules" JSONB NOT NULL DEFAULT '[]',
    "hashtagStrategy" JSONB NOT NULL DEFAULT '{}',
    "lengthTargets" JSONB NOT NULL DEFAULT '{}',
    "timeOfDayWeights" JSONB NOT NULL DEFAULT '{}',
    "rawPlaybook" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "copy" TEXT NOT NULL,
    "assetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduledFor" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "platformPostId" TEXT,
    "generatedByUserId" TEXT,
    "generationMeta" JSONB NOT NULL DEFAULT '{}',
    "approvedByUserId" TEXT,
    "postedByUserId" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reply" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "targetPostId" TEXT NOT NULL,
    "targetPostAuthorHandle" TEXT NOT NULL,
    "targetPostContent" TEXT NOT NULL,
    "copy" TEXT NOT NULL,
    "status" "ReplyStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "generationMeta" JSONB NOT NULL DEFAULT '{}',
    "postedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repost" (
    "id" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "sourcePostId" TEXT NOT NULL,
    "reposterAccountId" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),
    "status" "RepostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "postedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostEngagement" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "profileClicks" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyEngagement" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "profileClicks" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplyEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepostEngagement" (
    "id" TEXT NOT NULL,
    "repostId" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "profileClicks" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepostEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camp" (
    "id" TEXT NOT NULL,
    "weekOf" DATE NOT NULL,
    "status" "CampStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdByAlgorithm" BOOLEAN NOT NULL DEFAULT true,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampMembership" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampPairingHistory" (
    "id" TEXT NOT NULL,
    "accountAId" TEXT NOT NULL,
    "accountBId" TEXT NOT NULL,
    "weekOf" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampPairingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextNote" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "weight" INTEGER NOT NULL DEFAULT 5,
    "scope" JSONB NOT NULL DEFAULT '{"all": true}',
    "status" "ContextNoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightRule" (
    "id" TEXT NOT NULL,
    "kind" "InsightKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "impactEstimate" DOUBLE PRECISION NOT NULL,
    "computedFromDateStart" TIMESTAMP(3) NOT NULL,
    "computedFromDateEnd" TIMESTAMP(3) NOT NULL,
    "status" "InsightStatus" NOT NULL DEFAULT 'ACTIVE',
    "promotedToFormula" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBatch" (
    "id" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "kind" "TaskBatchKind" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "TaskBatchStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "orderInBatch" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "phoneDeviceId" TEXT,
    "action" "TaskAction" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "timeSpentSeconds" INTEGER,
    "escalationReason" TEXT,
    "createdRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualitySample" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "sampledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "verdict" "QualityVerdict",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualitySample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyUser_email_key" ON "AgencyUser"("email");

-- CreateIndex
CREATE INDEX "AgencyUser_agencyId_idx" ON "AgencyUser"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyMagicLink_tokenHash_key" ON "AgencyMagicLink"("tokenHash");

-- CreateIndex
CREATE INDEX "AgencyMagicLink_agencyUserId_idx" ON "AgencyMagicLink"("agencyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencySession_token_key" ON "AgencySession"("token");

-- CreateIndex
CREATE INDEX "AgencySession_agencyUserId_idx" ON "AgencySession"("agencyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE INDEX "Agency_status_idx" ON "Agency"("status");

-- CreateIndex
CREATE INDEX "Contract_agencyId_idx" ON "Contract"("agencyId");

-- CreateIndex
CREATE INDEX "Contract_startDate_endDate_idx" ON "Contract"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Model_agencyId_idx" ON "Model"("agencyId");

-- CreateIndex
CREATE INDEX "Model_archetype_idx" ON "Model"("archetype");

-- CreateIndex
CREATE UNIQUE INDEX "Account_handle_key" ON "Account"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Account_platformAccountId_key" ON "Account"("platformAccountId");

-- CreateIndex
CREATE INDEX "Account_modelId_idx" ON "Account"("modelId");

-- CreateIndex
CREATE INDEX "Account_status_idx" ON "Account"("status");

-- CreateIndex
CREATE INDEX "Account_phoneDeviceId_idx" ON "Account"("phoneDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneDevice_label_key" ON "PhoneDevice"("label");

-- CreateIndex
CREATE INDEX "AccountFollowerSnapshot_accountId_takenAt_idx" ON "AccountFollowerSnapshot"("accountId", "takenAt" DESC);

-- CreateIndex
CREATE INDEX "StatusTransition_accountId_occurredAt_idx" ON "StatusTransition"("accountId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "ContentAsset_modelId_idx" ON "ContentAsset"("modelId");

-- CreateIndex
CREATE INDEX "ContentAsset_tagStatus_idx" ON "ContentAsset"("tagStatus");

-- CreateIndex
CREATE INDEX "AssetUsage_assetId_usedAt_idx" ON "AssetUsage"("assetId", "usedAt" DESC);

-- CreateIndex
CREATE INDEX "AssetUsage_accountId_usedAt_idx" ON "AssetUsage"("accountId", "usedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ContentFormula_version_key" ON "ContentFormula"("version");

-- CreateIndex
CREATE INDEX "ContentFormula_status_idx" ON "ContentFormula"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Post_platformPostId_key" ON "Post"("platformPostId");

-- CreateIndex
CREATE INDEX "Post_accountId_status_idx" ON "Post"("accountId", "status");

-- CreateIndex
CREATE INDEX "Post_scheduledFor_idx" ON "Post"("scheduledFor");

-- CreateIndex
CREATE INDEX "Post_status_idx" ON "Post"("status");

-- CreateIndex
CREATE INDEX "Reply_accountId_status_idx" ON "Reply"("accountId", "status");

-- CreateIndex
CREATE INDEX "Reply_scheduledFor_idx" ON "Reply"("scheduledFor");

-- CreateIndex
CREATE INDEX "Repost_reposterAccountId_status_idx" ON "Repost"("reposterAccountId", "status");

-- CreateIndex
CREATE INDEX "Repost_campId_idx" ON "Repost"("campId");

-- CreateIndex
CREATE INDEX "Repost_scheduledFor_idx" ON "Repost"("scheduledFor");

-- CreateIndex
CREATE INDEX "PostEngagement_postId_capturedAt_idx" ON "PostEngagement"("postId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "ReplyEngagement_replyId_capturedAt_idx" ON "ReplyEngagement"("replyId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "RepostEngagement_repostId_capturedAt_idx" ON "RepostEngagement"("repostId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "Camp_weekOf_status_idx" ON "Camp"("weekOf", "status");

-- CreateIndex
CREATE INDEX "CampMembership_accountId_idx" ON "CampMembership"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "CampMembership_campId_accountId_key" ON "CampMembership"("campId", "accountId");

-- CreateIndex
CREATE INDEX "CampPairingHistory_weekOf_idx" ON "CampPairingHistory"("weekOf");

-- CreateIndex
CREATE INDEX "CampPairingHistory_accountAId_idx" ON "CampPairingHistory"("accountAId");

-- CreateIndex
CREATE INDEX "CampPairingHistory_accountBId_idx" ON "CampPairingHistory"("accountBId");

-- CreateIndex
CREATE UNIQUE INDEX "CampPairingHistory_accountAId_accountBId_weekOf_key" ON "CampPairingHistory"("accountAId", "accountBId", "weekOf");

-- CreateIndex
CREATE INDEX "ContextNote_status_effectiveFrom_effectiveUntil_idx" ON "ContextNote"("status", "effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE INDEX "InsightRule_status_kind_idx" ON "InsightRule"("status", "kind");

-- CreateIndex
CREATE INDEX "TaskBatch_assignedToUserId_status_idx" ON "TaskBatch"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "TaskBatch_scheduledFor_idx" ON "TaskBatch"("scheduledFor");

-- CreateIndex
CREATE INDEX "Task_batchId_orderInBatch_idx" ON "Task"("batchId", "orderInBatch");

-- CreateIndex
CREATE INDEX "Task_accountId_status_idx" ON "Task"("accountId", "status");

-- CreateIndex
CREATE INDEX "QualitySample_taskId_idx" ON "QualitySample"("taskId");

-- CreateIndex
CREATE INDEX "QualitySample_verdict_idx" ON "QualitySample"("verdict");

-- CreateIndex
CREATE INDEX "JobRun_jobName_startedAt_idx" ON "JobRun"("jobName", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyUser" ADD CONSTRAINT "AgencyUser_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyMagicLink" ADD CONSTRAINT "AgencyMagicLink_agencyUserId_fkey" FOREIGN KEY ("agencyUserId") REFERENCES "AgencyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencySession" ADD CONSTRAINT "AgencySession_agencyUserId_fkey" FOREIGN KEY ("agencyUserId") REFERENCES "AgencyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_phoneDeviceId_fkey" FOREIGN KEY ("phoneDeviceId") REFERENCES "PhoneDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountFollowerSnapshot" ADD CONSTRAINT "AccountFollowerSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusTransition" ADD CONSTRAINT "StatusTransition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusTransition" ADD CONSTRAINT "StatusTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_uploadedByAgencyUserId_fkey" FOREIGN KEY ("uploadedByAgencyUserId") REFERENCES "AgencyUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetUsage" ADD CONSTRAINT "AssetUsage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ContentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetUsage" ADD CONSTRAINT "AssetUsage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetUsage" ADD CONSTRAINT "AssetUsage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentFormula" ADD CONSTRAINT "ContentFormula_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repost" ADD CONSTRAINT "Repost_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repost" ADD CONSTRAINT "Repost_sourcePostId_fkey" FOREIGN KEY ("sourcePostId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repost" ADD CONSTRAINT "Repost_reposterAccountId_fkey" FOREIGN KEY ("reposterAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repost" ADD CONSTRAINT "Repost_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repost" ADD CONSTRAINT "Repost_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostEngagement" ADD CONSTRAINT "PostEngagement_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyEngagement" ADD CONSTRAINT "ReplyEngagement_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "Reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepostEngagement" ADD CONSTRAINT "RepostEngagement_repostId_fkey" FOREIGN KEY ("repostId") REFERENCES "Repost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camp" ADD CONSTRAINT "Camp_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampMembership" ADD CONSTRAINT "CampMembership_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampMembership" ADD CONSTRAINT "CampMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampPairingHistory" ADD CONSTRAINT "CampPairingHistory_accountAId_fkey" FOREIGN KEY ("accountAId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampPairingHistory" ADD CONSTRAINT "CampPairingHistory_accountBId_fkey" FOREIGN KEY ("accountBId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextNote" ADD CONSTRAINT "ContextNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBatch" ADD CONSTRAINT "TaskBatch_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TaskBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_phoneDeviceId_fkey" FOREIGN KEY ("phoneDeviceId") REFERENCES "PhoneDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitySample" ADD CONSTRAINT "QualitySample_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitySample" ADD CONSTRAINT "QualitySample_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

