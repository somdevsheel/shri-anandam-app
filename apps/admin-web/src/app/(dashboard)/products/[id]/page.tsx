"use client";

import { use } from "react";
import { useDeactivateProduct, useProduct } from "@/lib/hooks/use-products";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingBlock, EmptyState } from "@/components/ui/Feedback";
import { ProductDetailsForm } from "@/components/products/ProductDetailsForm";
import { VariantsSection } from "@/components/products/VariantsSection";
import { AddonsSection } from "@/components/products/AddonsSection";
import { BranchesSection } from "@/components/products/BranchesSection";
import { ImagesSection } from "@/components/products/ImagesSection";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: product, isLoading, error } = useProduct(id);
  const deactivateProduct = useDeactivateProduct();

  if (isLoading) return <LoadingBlock />;
  if (error || !product) return <EmptyState title="Couldn't load this product" />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{product.name}</h1>
          <p className="mt-1 text-sm text-text-muted">/{product.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge status={product.isActive ? "ACTIVE" : "INACTIVE"} />
          {product.isActive ? (
            <Button variant="danger" onClick={() => deactivateProduct.mutate(product.id)} loading={deactivateProduct.isPending}>
              Deactivate
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <ProductDetailsForm key={product.id} product={product} />
        <VariantsSection product={product} />
        <ImagesSection product={product} />
        <AddonsSection product={product} />
        <BranchesSection product={product} />
      </div>
    </div>
  );
}
