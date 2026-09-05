"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProductSchema } from "@shri-anandam/validation";
import { useCreateProduct } from "@/lib/hooks/use-products";
import { useCategories } from "@/lib/hooks/use-catalog-support";
import { orderedCategoriesWithDepth } from "@/lib/category-tree";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { ErrorBlock } from "@/components/ui/Feedback";

export default function NewProductPage() {
  const router = useRouter();
  const { data: categories } = useCategories();
  const orderedCategories = orderedCategoriesWithDepth(categories?.items ?? []);
  const createProduct = useCreateProduct();

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const result = createProductSchema.safeParse({
      categoryId,
      name,
      description: description || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isFeatured,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the form for errors");
      return;
    }
    setError(null);
    createProduct.mutate(result.data, {
      onSuccess: (product) => router.replace(`/products/${product.id}`),
      onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create product."),
    });
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-text">New Product</h1>

      <Card className="mt-6 flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Select a category</option>
          {orderedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Textarea label="Description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Tags" hint="Comma-separated, e.g. bestseller, diwali-special" value={tags} onChange={(e) => setTags(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="size-4" />
          Featured product
        </label>

        {error ? <ErrorBlock message={error} /> : null}

        <Button onClick={handleSubmit} loading={createProduct.isPending} disabled={!name || !categoryId}>
          Create Product
        </Button>
        <p className="text-xs text-text-muted">Variants, add-ons, and branch availability can be set up after the product is created.</p>
      </Card>
    </div>
  );
}
