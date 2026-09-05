"use client";

import { useState } from "react";
import Link from "next/link";
import { createCategorySchema } from "@shri-anandam/validation";
import { useCategories, useCreateCategory, useUpdateCategory } from "@/lib/hooks/use-catalog-support";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";
import { SubTabs } from "@/components/SubTabs";
import { ApiError } from "@/lib/api-client";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const { data, isLoading, error } = useCategories({ pageSize: 100 });
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const topLevel = (data?.items ?? []).filter((c) => !c.parentId);

  const handleAdd = () => {
    const result = createCategorySchema.safeParse({ name, parentId: parentId || undefined });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "Enter a category name");
      return;
    }
    setFormError(null);
    createCategory.mutate(result.data, {
      onSuccess: () => {
        setName("");
        setParentId("");
      },
      onError: (err) => setFormError(err instanceof ApiError ? err.message : "Could not create category."),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Products</h1>
        <Link href="/products/new">
          <Button>New Product</Button>
        </Link>
      </div>

      <SubTabs
        items={[
          { href: "/products", label: "Products" },
          { href: "/products/categories", label: "Categories" },
          { href: "/products/addons", label: "Add-ons" },
        ]}
      />

      <Card className="mb-6">
        <CardHeader title="New Category" />
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Top-level category</option>
            {topLevel.map((c) => (
              <option key={c.id} value={c.id}>
                Subcategory of: {c.name}
              </option>
            ))}
          </Select>
          <Button onClick={handleAdd} loading={createCategory.isPending} disabled={!name}>
            Add
          </Button>
        </div>
        {formError ? (
          <div className="mt-2">
            <ErrorBlock message={formError} />
          </div>
        ) : null}
      </Card>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-4">
            <ErrorBlock message="Couldn't load categories." />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No categories yet" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {topLevel.map((category) => (
                <CategoryRows key={category.id} category={category} depth={0} allCategories={data.items} updateCategory={updateCategory} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CategoryRows({
  category,
  depth,
  allCategories,
  updateCategory,
}: {
  category: Category;
  depth: number;
  allCategories: Category[];
  updateCategory: ReturnType<typeof useUpdateCategory>;
}) {
  const children = allCategories.filter((c) => c.parentId === category.id);
  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="px-4 py-3 font-semibold text-text" style={{ paddingLeft: `${1 + depth * 1.5}rem` }}>
          {depth > 0 ? <span className="mr-2 text-text-muted">↳</span> : null}
          {category.name}
        </td>
        <td className="px-4 py-3">
          <Badge status={category.isActive ? "ACTIVE" : "INACTIVE"} />
        </td>
        <td className="px-4 py-3 text-right">
          <Button
            variant="ghost"
            onClick={() => updateCategory.mutate({ id: category.id, dto: { isActive: !category.isActive } })}
          >
            {category.isActive ? "Deactivate" : "Activate"}
          </Button>
        </td>
      </tr>
      {children.map((child) => (
        <CategoryRows key={child.id} category={child} depth={depth + 1} allCategories={allCategories} updateCategory={updateCategory} />
      ))}
    </>
  );
}
