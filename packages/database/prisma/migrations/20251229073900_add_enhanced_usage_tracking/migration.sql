-- AlterTable
ALTER TABLE "UsageEvent" ADD COLUMN     "cachedTokens" INTEGER,
ADD COLUMN     "cost" DECIMAL(10,6),
ADD COLUMN     "inputData" JSONB,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "reasoning" TEXT,
ADD COLUMN     "reasoningTokens" INTEGER,
ADD COLUMN     "result" TEXT;

-- CreateIndex
CREATE INDEX "UsageEvent_userId_timestamp_idx" ON "UsageEvent"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "UsageEvent_name_timestamp_idx" ON "UsageEvent"("name", "timestamp");
