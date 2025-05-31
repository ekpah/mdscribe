-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "embedding" vector(1024);
