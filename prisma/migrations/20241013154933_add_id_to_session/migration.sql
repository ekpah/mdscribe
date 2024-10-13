-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");
