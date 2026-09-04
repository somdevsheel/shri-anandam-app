-- AlterTable
ALTER TABLE "products" ADD COLUMN     "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ingredients" TEXT,
ADD COLUMN     "nutritionalInfo" JSONB;
