"use client";

import { useState } from "react";
import { createProductImageSchema } from "@shri-anandam/validation";
import { useAddImage, useRemoveImage } from "@/lib/hooks/use-products";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ErrorBlock } from "@/components/ui/Feedback";
import type { Product } from "@/lib/types";

/**
 * URL-only — services/api's addImage endpoint (createProductImageSchema)
 * takes a `url`, not a file upload; there's no S3/object-storage upload
 * flow wired up anywhere in this repo yet (packages/config's S3_* env
 * vars exist but no upload endpoint consumes them). A real file-upload
 * UI is a reasonable follow-up once that backend piece exists — this
 * matches what the API can actually do today.
 */
export function ImagesSection({ product }: { product: Product }) {
  const addImage = useAddImage(product.id);
  const removeImage = useRemoveImage(product.id);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const result = createProductImageSchema.safeParse({ url, sortOrder: product.images.length });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid image URL");
      return;
    }
    setError(null);
    addImage.mutate(result.data, { onSuccess: () => setUrl(""), onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add image.") });
  };

  return (
    <Card>
      <CardHeader title="Images" />
      <div className="flex flex-wrap gap-3">
        {product.images.map((image) => (
          <div key={image.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external URLs, not optimizable via next/image without remotePatterns config per source */}
            <img src={image.url} alt={image.altText ?? ""} className="size-24 rounded-lg border border-border object-cover" />
            <button
              onClick={() => removeImage.mutate(image.id)}
              className="absolute -right-2 -top-2 hidden size-6 items-center justify-center rounded-full bg-danger text-xs font-bold text-on-primary group-hover:flex"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2 border-t border-border pt-4">
        <div className="flex-1">
          <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <Button onClick={handleAdd} loading={addImage.isPending} disabled={!url}>
          Add
        </Button>
      </div>
      {error ? (
        <div className="mt-2">
          <ErrorBlock message={error} />
        </div>
      ) : null}
    </Card>
  );
}
