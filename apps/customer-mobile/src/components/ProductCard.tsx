import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { colors, radius, spacing, typography } from "@/theme/theme";
import { PriceTag } from "./ui/PriceTag";
import type { Product } from "@/api/types";

interface ProductCardProps {
  product: Product;
}

/** The card used in every product grid (Home's featured rail, category listing, search results). */
export function ProductCard({ product }: ProductCardProps) {
  const activeVariants = product.variants.filter((v) => v.isActive);
  const cheapestVariant = activeVariants
    .filter((v): v is typeof v & { priceInPaise: number } => v.priceInPaise !== null)
    .sort((a, b) => a.priceInPaise - b.priceInPaise)[0];
  // Distinct from "no active variant at all" — this one has a real
  // sellable option, the admin just hasn't set its price yet.
  const isPriceTbd = activeVariants.length > 0 && !cheapestVariant;
  const image = product.images[0];

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
        {cheapestVariant ? (
          <PriceTag priceInPaise={cheapestVariant.priceInPaise} compareAtPriceInPaise={cheapestVariant.compareAtPriceInPaise} />
        ) : isPriceTbd ? (
          <Text style={styles.unavailable}>Price coming soon</Text>
        ) : (
          <Text style={styles.unavailable}>Currently unavailable</Text>
        )}
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
  unavailable: { ...typography.caption, color: colors.textMuted },
});
