import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { colors, fonts, radius, spacing, typography } from "@/theme/theme";
import { useAddCartItem } from "@/api/hooks/use-cart";
import { ApiError } from "@/api/client";
import { PriceTag } from "./ui/PriceTag";
import type { Product } from "@/api/types";

interface ProductCardProps {
  product: Product;
}

/** The card used in every product grid (Home's featured rail, category listing, search results). */
export function ProductCard({ product }: ProductCardProps) {
  const addToCart = useAddCartItem();
  const activeVariants = product.variants.filter((v) => v.isActive);
  const cheapestVariant = activeVariants
    .filter((v): v is typeof v & { priceInPaise: number } => v.priceInPaise !== null)
    .sort((a, b) => a.priceInPaise - b.priceInPaise)[0];
  // Distinct from "no active variant at all" — this one has a real
  // sellable option, the admin just hasn't set its price yet.
  const isPriceTbd = activeVariants.length > 0 && !cheapestVariant;
  const image = product.images[0];
  const branchId = product.branchProducts[0]?.branchId;

  // Only safe to add straight from the grid when there's exactly one
  // choice to make (one active variant, no add-ons) — anything else
  // needs the product page so the customer actually picks.
  const canQuickAdd = activeVariants.length === 1 && product.productAddons.length === 0 && !isPriceTbd && Boolean(branchId);

  const handleAdd = () => {
    const soleVariant = activeVariants[0];
    if (!canQuickAdd || !branchId || !soleVariant) {
      router.push(`/product/${product.slug}`);
      return;
    }
    addToCart.mutate(
      { branchId, productId: product.id, variantId: soleVariant.id, quantity: soleVariant.minOrderQuantity, addonIds: [] },
      {
        onSuccess: () => Alert.alert("Added to cart", product.name),
        onError: (err) => Alert.alert("Couldn't add to cart", err instanceof ApiError ? err.message : "Please try again."),
      },
    );
  };

  const ctaLabel = !cheapestVariant && !isPriceTbd ? null : canQuickAdd ? "Add" : "Select";

  return (
    <Link href={`/product/${product.slug}`} asChild>
      <Pressable style={styles.card} accessibilityRole="button" accessibilityLabel={product.name}>
        <View style={styles.imageWrapper}>
          {image ? (
            <Image source={{ uri: image.url }} style={styles.image} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]} />
          )}
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.footer}>
          <View style={styles.priceColumn}>
            {cheapestVariant ? (
              <PriceTag priceInPaise={cheapestVariant.priceInPaise} compareAtPriceInPaise={cheapestVariant.compareAtPriceInPaise} />
            ) : (
              <Text style={styles.unavailable}>{isPriceTbd ? "Price coming soon" : "Currently unavailable"}</Text>
            )}
          </View>
          {ctaLabel ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleAdd();
              }}
              disabled={addToCart.isPending}
              accessibilityRole="button"
              accessibilityLabel={`${ctaLabel} ${product.name}`}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaLabel}>{ctaLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const CARD_WIDTH = "48%";

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageWrapper: {
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: { backgroundColor: colors.border },
  name: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs, minHeight: 38 },
  footer: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.xs, marginTop: "auto" },
  priceColumn: { flex: 1, minWidth: 0 },
  unavailable: { ...typography.caption, color: colors.textMuted },
  ctaButton: {
    height: 32,
    minWidth: 52,
    paddingHorizontal: spacing.sm,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 12.5, fontWeight: "700", color: colors.primary },
});
