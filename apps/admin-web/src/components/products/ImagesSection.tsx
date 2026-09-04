"use client";

import { useRef, useState } from "react";
import { useAddImage, useRemoveImage, useUploadProductImage } from "@/lib/hooks/use-products";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorBlock } from "@/components/ui/Feedback";
import type { Product } from "@/lib/types";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Direct file upload — POST /uploads/product-image (multipart) uploads to
 * S3 and returns a public URL, then that URL is attached to the product
 * via the existing POST /products/:id/images (unchanged). Two requests,
 * not one: the upload endpoint has nothing product-specific to know
 * about, and this mirrors how services/api's addImage already works.
 */
export function ImagesSection({ product }: { product: Product }) {
  const uploadImage = useUploadProductImage();
  const addImage = useAddImage(product.id);
  const removeImage = useRemoveImage(product.id);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = uploadImage.isPending || addImage.isPending;

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after an error
    if (!file) return;

    if (!ACCEPTED_TYPES.split(",").includes(file.type)) {
      setError("Only JPEG, PNG, or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large — 5 MB max.");
      return;
    }

    setError(null);
    uploadImage.mutate(file, {
      onSuccess: (uploaded) => {
        addImage.mutate(
          { url: uploaded.url, sortOrder: product.images.length },
          { onError: (err) => setError(err instanceof ApiError ? err.message : "Uploaded, but couldn't attach the image to this product.") },
        );
      },
      onError: (err) => setError(err instanceof ApiError ? err.message : "Could not upload image."),
    });
  };

  return (
    <Card>
      <CardHeader title="Images" />
      <div className="flex flex-wrap gap-3">
        {product.images.map((image) => (
          <div key={image.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- S3 URLs, not optimizable via next/image without remotePatterns config per source */}
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

      <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleFileSelected} />
        <Button onClick={() => fileInputRef.current?.click()} loading={isBusy} disabled={isBusy}>
          {isBusy ? "Uploading…" : "Upload image"}
        </Button>
        <span className="text-xs text-text-muted">JPEG, PNG, or WebP — 5 MB max</span>
      </div>
      {error ? (
        <div className="mt-2">
          <ErrorBlock message={error} />
        </div>
      ) : null}
    </Card>
  );
}
