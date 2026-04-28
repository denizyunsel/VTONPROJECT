-- AlterEnum: rename STYLE to COMPOSITION
ALTER TYPE "StyleAssetType" RENAME VALUE 'STYLE' TO 'COMPOSITION';

-- AlterTable: add seed column to TryOnJob
ALTER TABLE "TryOnJob" ADD COLUMN "seed" INTEGER;

-- AlterTable: add sendToPrompt column to StyleAsset
ALTER TABLE "StyleAsset" ADD COLUMN "sendToPrompt" BOOLEAN NOT NULL DEFAULT true;
