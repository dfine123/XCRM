-- CreateEnum
CREATE TYPE "DriveSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetAuditKind" AS ENUM ('DELETE', 'RESTORE', 'MANUAL_TAG_EDIT', 'REVIEW_OVERRIDE');

-- AlterTable
ALTER TABLE "ContentAsset" ADD COLUMN     "driveChecksum" TEXT,
ADD COLUMN     "driveFileId" TEXT,
ADD COLUMN     "driveSourceId" TEXT;

-- CreateTable
CREATE TABLE "DriveSource" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" "DriveSyncStatus",
    "cursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DriveSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveSync" (
    "id" TEXT NOT NULL,
    "driveSourceId" TEXT NOT NULL,
    "status" "DriveSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "filesSeen" INTEGER NOT NULL DEFAULT 0,
    "filesIngested" INTEGER NOT NULL DEFAULT 0,
    "filesSkipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "triggeredByUserId" TEXT,

    CONSTRAINT "DriveSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAuditEvent" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" "AssetAuditKind" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriveSource_modelId_isActive_idx" ON "DriveSource"("modelId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DriveSource_modelId_folderId_key" ON "DriveSource"("modelId", "folderId");

-- CreateIndex
CREATE INDEX "DriveSync_driveSourceId_startedAt_idx" ON "DriveSync"("driveSourceId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "AssetAuditEvent_assetId_occurredAt_idx" ON "AssetAuditEvent"("assetId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "ContentAsset_driveSourceId_idx" ON "ContentAsset"("driveSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAsset_driveSourceId_driveFileId_key" ON "ContentAsset"("driveSourceId", "driveFileId");

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_driveSourceId_fkey" FOREIGN KEY ("driveSourceId") REFERENCES "DriveSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveSource" ADD CONSTRAINT "DriveSource_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveSource" ADD CONSTRAINT "DriveSource_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveSync" ADD CONSTRAINT "DriveSync_driveSourceId_fkey" FOREIGN KEY ("driveSourceId") REFERENCES "DriveSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveSync" ADD CONSTRAINT "DriveSync_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAuditEvent" ADD CONSTRAINT "AssetAuditEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ContentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAuditEvent" ADD CONSTRAINT "AssetAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

