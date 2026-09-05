"use client";

import { useState } from "react";
import Link from "next/link";
import { useProducts } from "@/lib/hooks/use-products";
import { useCategories } from "@/lib/hooks/use-catalog-support";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";
import { Pagination } from "@/components/ui/Pagination";
import { SubTabs } from "@/components/SubTabs";
import { formatInr } from "@/lib/format";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);

  const { data: categories } = useCategories();
  const { data, isLoading, error } = useProducts({ search: search || undefined, categoryId: categoryId || undefined, page });

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

      <div className="mb-4 flex gap-3">
        <div className="w-64">
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-56">
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-4">
            <ErrorBlock message="Couldn't load products." />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No products found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Variants</th>
                  <th className="px-4 py-3">Price range</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((product) => {
                  // Variants with a "TBD" (null) price don't count toward
                  // the range — a product where every variant is still
                  // unpriced shows "—", not "₹0".
                  const prices = product.variants.map((v) => v.priceInPaise).filter((p): p is number => p !== null);
                  const min = prices.length ? Math.min(...prices) : 0;
                  const max = prices.length ? Math.max(...prices) : 0;
                  return (
                    <tr key={product.id} className="border-b border-border last:border-0 hover:bg-background/50">
                      <td className="px-4 py-3">
                        <Link href={`/products/${product.id}`} className="font-semibold text-primary hover:underline">
                          {product.name}
                        </Link>
                        {product.isFeatured ? <span className="ml-2 text-xs font-semibold text-accent">Featured</span> : null}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{product.category.name}</td>
                      <td className="px-4 py-3 text-text-muted">{product.variants.length}</td>
                      <td className="px-4 py-3 text-text-muted">{prices.length ? (min === max ? formatInr(min) : `${formatInr(min)} – ${formatInr(max)}`) : "—"}</td>
                      <td className="px-4 py-3">
                        <Badge status={product.isActive ? "ACTIVE" : "INACTIVE"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data ? (
          <div className="px-4 py-3">
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
