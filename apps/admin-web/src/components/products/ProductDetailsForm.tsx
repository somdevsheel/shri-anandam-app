"use client";

import { useState } from "react";
import { updateProductSchema } from "@shri-anandam/validation";
import { useUpdateProduct } from "@/lib/hooks/use-products";
import { useCategories } from "@/lib/hooks/use-catalog-support";
import { orderedCategoriesWithDepth } from "@/lib/category-tree";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { ErrorBlock } from "@/components/ui/Feedback";
import type { Product } from "@/lib/types";

/**
 * Rendered with `key={product.id}` by the parent so React initializes
 * this component's state fresh from `product` on mount rather than
 * syncing it in a `useEffect` (a lint-flagged anti-pattern —
 * react-hooks/set-state-in-effect — that also causes an extra render).
 * A successful save updates the query cache in place without changing
 * `product.id`, so this intentionally does NOT remount/reset on save.
 */
export function ProductDetailsForm({ product }: { product: Product }) {
  const { data: categories } = useCategories();
  const orderedCategories = orderedCategoriesWithDepth(categories?.items ?? []);
  const updateProduct = useUpdateProduct(product.id);

  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [description, setDescription] = useState(product.description ?? "");
  const [tags, setTags] = useState(product.tags.join(", "));
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [isVeg, setIsVeg] = useState(product.isVeg);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = () => {
    const result = updateProductSchema.safeParse({
      name,
      categoryId,
      description: description || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isFeatured,
      isVeg,
    });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "Check the form for errors");
      return;
    }
    setFormError(null);
    updateProduct.mutate(result.data, {
      onError: (err) => setFormError(err instanceof ApiError ? err.message : "Could not save changes."),
    });
  };

  return (
    <Card>
      <CardHeader title="Details" />
      <div className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {orderedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Textarea label="Description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Tags" hint="Comma-separated" value={tags} onChange={(e) => setTags(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="size-4" />
          Featured product
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isVeg} onChange={(e) => setIsVeg(e.target.checked)} className="size-4" />
          Vegetarian
        </label>
        {formError ? <ErrorBlock message={formError} /> : null}
        <Button onClick={handleSave} loading={updateProduct.isPending} className="self-start">
          Save Changes
        </Button>
      </div>
    </Card>
  );
}
