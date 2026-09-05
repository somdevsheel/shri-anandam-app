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
import { colors, fonts, radius, spacing, typography } from "@/theme/theme";
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
        <Text style={styles.title}>Your cart</Text>
        <EmptyState
          icon="basket-outline"
          title="Your cart is waiting for something delicious"
          message="Sweets by weight, restaurant plates and gift boxes — all from one kitchen."
        />
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
      <View style={styles.header}>
        <Text style={styles.title}>Your cart</Text>
        <Text style={styles.branchLabel}>Ordering from {cart.branch.name}</Text>
      </View>

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
        <Text style={styles.taxNote}>Delivery fee and taxes are calculated at checkout</Text>
        <Button
          label={`Proceed to checkout · ${formatInr(data?.subtotalInPaise ?? 0)}`}
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...typography.display, fontSize: 21, color: colors.text },
  branchLabel: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textMuted, marginTop: 4 },
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
    backgroundColor: colors.warningBackground,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  issueBannerText: { ...typography.caption, color: colors.warning, flex: 1 },
  taxNote: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, textAlign: "center" },
});
