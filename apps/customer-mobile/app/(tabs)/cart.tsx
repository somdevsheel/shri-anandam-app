import { FlatList, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { formatInr } from "@shri-anandam/shared-types";
import { CartItemRow } from "@/components/CartItemRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import { Button } from "@/components/ui/Button";
import { useCart, useRemoveCartItem, useUpdateCartItem } from "@/api/hooks/use-cart";
import { colors, radius, spacing, typography } from "@/theme/theme";
import type { CartItemLine } from "@/api/types";

export default function CartScreen() {
  const { data, isLoading } = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();

  if (isLoading) return <LoadingView />;

  const cart = data?.cart;
  const issuesByItemId = new Map((data?.issues ?? []).map((issue) => [issue.cartItemId, issue.message]));
  const hasBlockingIssues = (data?.issues.length ?? 0) > 0;

  if (!cart || cart.items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <EmptyState icon="basket-outline" title="Your cart is empty" message="Add something delicious from the menu." />
      </SafeAreaView>
    );
  }

  const changeQuantity = (item: CartItemLine, delta: number) => {
    const nextQuantity = item.quantity + delta;
    if (nextQuantity <= 0) {
      removeItem.mutate(item.id);
    } else {
      updateItem.mutate({ itemId: item.id, dto: { quantity: nextQuantity } });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.branchLabel}>Ordering from {cart.branch.name}</Text>

      <FlatList
        data={cart.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            issueMessage={issuesByItemId.get(item.id)}
            onIncrement={() => changeQuantity(item, 1)}
            onDecrement={() => changeQuantity(item, -1)}
            onRemove={() => removeItem.mutate(item.id)}
            isUpdating={updateItem.isPending || removeItem.isPending}
          />
        )}
      />

      <View style={styles.summary}>
        {hasBlockingIssues ? (
          <View style={styles.issueBanner}>
            <Ionicons name="alert-circle" size={16} color={colors.warning} />
            <Text style={styles.issueBannerText}>Fix the items marked above before checking out</Text>
          </View>
        ) : null}
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Subtotal</Text>
          <Text style={styles.subtotalValue}>{formatInr(data?.subtotalInPaise ?? 0)}</Text>
        </View>
        <Text style={styles.taxNote}>Delivery fee and taxes are calculated at checkout</Text>
        <Button
          label="Proceed to Checkout"
          onPress={() => router.push("/checkout")}
          disabled={hasBlockingIssues}
          testID="checkout-button"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  branchLabel: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.sm },
  listContent: { padding: spacing.lg, paddingBottom: spacing.md },
  summary: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  issueBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "#FBF0DD",
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  issueBannerText: { ...typography.caption, color: colors.warning, flex: 1 },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  subtotalLabel: { ...typography.body, color: colors.textMuted },
  subtotalValue: { ...typography.h3, color: colors.text },
  taxNote: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
});
