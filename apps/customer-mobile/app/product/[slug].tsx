import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatInr } from "@shri-anandam/shared-types";
import { useProduct } from "@/api/hooks/use-catalog";
import { useAddCartItem } from "@/api/hooks/use-cart";
import { LoadingView } from "@/components/ui/LoadingView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/api/client";
import { colors, radius, spacing, typography } from "@/theme/theme";
import type { ProductVariant } from "@/api/types";

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const navigation = useNavigation();
  const { data: product, isLoading } = useProduct(slug);
  const addToCart = useAddCartItem();

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    navigation.setOptions({ title: product?.name ?? "" });
  }, [navigation, product?.name]);

  const activeVariants = useMemo(() => (product?.variants ?? []).filter((v) => v.isActive), [product]);
  const selectedVariant: ProductVariant | undefined =
    activeVariants.find((v) => v.id === selectedVariantId) ?? activeVariants[0];
  const availableBranch = product?.branchProducts[0];

  if (isLoading) return <LoadingView />;
  if (!product) {
    return <EmptyState icon="alert-circle-outline" title="Product not found" message="It may have been removed." />;
  }

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(addonId)) next.delete(addonId);
      else next.add(addonId);
      return next;
    });
  };

  const addonsTotal = product.productAddons
    .filter((pa) => selectedAddonIds.has(pa.addon.id))
    .reduce((sum, pa) => sum + pa.addon.priceInPaise, 0);
  const unitPrice = (selectedVariant?.priceInPaise ?? 0) + addonsTotal;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    if (!selectedVariant || !availableBranch) return;
    addToCart.mutate(
      {
        branchId: availableBranch.branchId,
        productId: product.id,
        variantId: selectedVariant.id,
        quantity,
        addonIds: Array.from(selectedAddonIds),
      },
      {
        onSuccess: () => Alert.alert("Added to cart", `${quantity} × ${product.name} (${selectedVariant.name})`),
        onError: (err) =>
          Alert.alert("Couldn't add to cart", err instanceof ApiError ? err.message : "Please try again."),
      },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {product.images[0] ? (
        <Image source={{ uri: product.images[0].url }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}

      <Text style={styles.name}>{product.name}</Text>
      {product.description ? <Text style={styles.description}>{product.description}</Text> : null}

      {product.allergens.length > 0 ? (
        <View style={styles.allergenRow}>
          <Ionicons name="warning-outline" size={16} color={colors.warning} />
          <Text style={styles.allergenText}>Contains: {product.allergens.join(", ")}</Text>
        </View>
      ) : null}

      {activeVariants.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Choose size</Text>
          <View style={styles.optionRow}>
            {activeVariants.map((variant) => (
              <Pressable
                key={variant.id}
                onPress={() => setSelectedVariantId(variant.id)}
                style={[styles.optionChip, variant.id === selectedVariant?.id && styles.optionChipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: variant.id === selectedVariant?.id }}
              >
                <Text style={[styles.optionLabel, variant.id === selectedVariant?.id && styles.optionLabelSelected]}>
                  {variant.name}
                </Text>
                <Text style={[styles.optionPrice, variant.id === selectedVariant?.id && styles.optionLabelSelected]}>
                  {formatInr(variant.priceInPaise)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <EmptyState icon="close-circle-outline" title="Currently unavailable" />
      )}

      {product.productAddons.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Add-ons</Text>
          <View style={styles.optionRow}>
            {product.productAddons.map(({ addon }) => (
              <Pressable
                key={addon.id}
                onPress={() => toggleAddon(addon.id)}
                style={[styles.optionChip, selectedAddonIds.has(addon.id) && styles.optionChipSelected]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedAddonIds.has(addon.id) }}
              >
                <Text style={[styles.optionLabel, selectedAddonIds.has(addon.id) && styles.optionLabelSelected]}>
                  {addon.name}
                </Text>
                <Text style={[styles.optionPrice, selectedAddonIds.has(addon.id) && styles.optionLabelSelected]}>
                  +{formatInr(addon.priceInPaise)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Quantity</Text>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
          onPress={() => setQuantity((q) => Math.max(1, q - 1))}
          style={styles.stepperButton}
        >
          <Ionicons name="remove" size={18} color={colors.primary} />
        </Pressable>
        <Text style={styles.quantityText}>{quantity}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
          onPress={() => setQuantity((q) => Math.min(99, q + 1))}
          style={styles.stepperButton}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatInr(totalPrice)}</Text>
        </View>
        <Button
          label={availableBranch ? "Add to Cart" : "Not available"}
          onPress={handleAddToCart}
          disabled={!selectedVariant || !availableBranch}
          loading={addToCart.isPending}
          style={styles.addButton}
          testID="add-to-cart-button"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  image: { width: "100%", aspectRatio: 1.2, borderRadius: radius.md, marginBottom: spacing.md },
  imagePlaceholder: { backgroundColor: colors.border },
  name: { ...typography.h2, color: colors.text },
  description: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  allergenRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  allergenText: { ...typography.caption, color: colors.warning },
  sectionTitle: { ...typography.h3, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  optionChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  optionChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionLabel: { ...typography.bodyBold, color: colors.text },
  optionLabelSelected: { color: colors.onPrimary },
  optionPrice: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: { ...typography.h3, color: colors.text, minWidth: 24, textAlign: "center" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { ...typography.caption, color: colors.textMuted },
  totalValue: { ...typography.h2, color: colors.text },
  addButton: { minWidth: 170 },
});
