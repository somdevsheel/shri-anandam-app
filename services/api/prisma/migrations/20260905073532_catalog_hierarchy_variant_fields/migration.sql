-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('PIECE', 'PLATE', 'HALF_PLATE', 'FULL_PLATE', 'GRAM', 'KILOGRAM', 'ML', 'LITRE', 'BOX', 'PACKET');

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "gstRatePercent" DECIMAL(5,2),
ADD COLUMN     "maxOrderQuantity" INTEGER,
ADD COLUMN     "minOrderQuantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
ADD COLUMN     "unit" "ProductUnit" NOT NULL DEFAULT 'PIECE',
ALTER COLUMN "priceInPaise" DROP NOT NULL;

-- CreateTable
CREATE TABLE "branch_product_variants" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_product_variants_branchId_isActive_idx" ON "branch_product_variants"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "branch_product_variants_branchId_productVariantId_key" ON "branch_product_variants"("branchId", "productVariantId");

-- AddForeignKey
ALTER TABLE "branch_product_variants" ADD CONSTRAINT "branch_product_variants_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_product_variants" ADD CONSTRAINT "branch_product_variants_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
