-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('READER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'READER';
