import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatInr, OrderStatus } from "@shri-anandam/shared-types";
import { useCancelOrder, useOrder } from "@/api/hooks/use-orders";
import { useRealtimeOrders } from "@/api/use-realtime";
import { ApiError } from "@/api/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import { colors, radius, spacing, typography } from "@/theme/theme";
import { formatDateTime } from "@/lib/format";

const TERMINAL_STATUSES = new Set<string>([OrderStatus.DELIVERED, OrderStatus.REJECTED, OrderStatus.CANCELLED]);

/**
 * Order tracking (Phase 11's live-status-updates target for customers).
 * `useOrder` still refetches on focus/mount regardless — the WebSocket
 * layer only shortens how long a stale status is shown while the
 * screen is actually open, it's never the only thing keeping this
 * screen correct.
 */
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, error, refetch } = useOrder(id);
  const cancelOrder = useCancelOrder(id ?? "");
  const [cancelError, setCancelError] = useState<string | null>(null);

  useRealtimeOrders(() => void refetch());

  if (isLoading) return <LoadingView />;
  if (error || !order) return <EmptyState icon="alert-circle-outline" title="Couldn't load this order" />;

  const canCancel = !TERMINAL_STATUSES.has(order.status);

  const handleCancel = () => {
    Alert.alert("Cancel this order?", `Order #${order.orderNumber} will be cancelled.`, [
      { text: "Keep Order", style: "cancel" },
      {
        text: "Cancel Order",
        style: "destructive",
        onPress: () => {
          setCancelError(null);
          cancelOrder.mutate(
            {},
            { onError: (err) => setCancelError(err instanceof ApiError ? err.message : "Could not cancel your order.") },
          );
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
            <Text style={styles.placedAt}>Placed {formatDateTime(order.placedAt)}</Text>
          </View>
          <StatusBadge status={order.status} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {item.quantity}× {item.productNameSnapshot}
                </Text>
                <Text style={styles.itemVariant}>{item.variantNameSnapshot}</Text>
                {item.addons.map((addon) => (
                  <Text key={addon.id} style={styles.itemVariant}>
                    + {addon.addonNameSnapshot}
                  </Text>
                ))}
              </View>
              <Text style={styles.itemPrice}>{formatInr(item.finalPriceInPaise)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <TotalsRow label="Subtotal" value={order.subtotalInPaise} />
          {order.discountInPaise > 0 ? <TotalsRow label="Discount" value={-order.discountInPaise} /> : null}
          {order.deliveryFeeInPaise > 0 ? <TotalsRow label="Delivery Fee" value={order.deliveryFeeInPaise} /> : null}
          {order.taxInPaise > 0 ? <TotalsRow label="Tax" value={order.taxInPaise} /> : null}
          <TotalsRow label="Total" value={order.totalInPaise} bold />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{order.fulfillmentType === "PICKUP" ? "Pickup Location" : "Delivery Address"}</Text>
          {order.fulfillmentType === "PICKUP" ? (
            <Text style={styles.bodyText}>{order.branch.name}</Text>
          ) : order.addressSnapshot ? (
            <Text style={styles.bodyText}>
              {order.addressSnapshot.line1}
              {order.addressSnapshot.line2 ? `, ${order.addressSnapshot.line2}` : ""}, {order.addressSnapshot.city},{" "}
              {order.addressSnapshot.state} {order.addressSnapshot.pincode}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          {order.payments.map((payment) => (
            <View key={payment.id} style={styles.itemRow}>
              <Text style={styles.bodyText}>
                {payment.method} · {payment.status}
              </Text>
              <Text style={styles.itemPrice}>{formatInr(payment.amountInPaise)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status History</Text>
          {order.statusHistory.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <View style={styles.historyDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{entry.newStatus}</Text>
                <Text style={styles.itemVariant}>{formatDateTime(entry.createdAt)}</Text>
              </View>
            </View>
          ))}
        </View>

        {cancelError ? <Text style={styles.error}>{cancelError}</Text> : null}
        {canCancel ? (
          <Button label="Cancel Order" variant="danger" onPress={handleCancel} loading={cancelOrder.isPending} style={styles.cancelButton} />
        ) : null}
        <Button label="Back to Orders" variant="outline" onPress={() => router.replace("/(tabs)/orders")} style={styles.cancelButton} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TotalsRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.totalsRow}>
      <Text style={bold ? styles.itemName : styles.itemVariant}>{label}</Text>
      <Text style={bold ? styles.itemName : styles.itemVariant}>{formatInr(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderNumber: { ...typography.h2, color: colors.text },
  placedAt: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sectionTitle: { ...typography.bodyBold, color: colors.textMuted, textTransform: "uppercase", fontSize: 12, marginBottom: spacing.sm },
  itemRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  itemName: { ...typography.bodyBold, color: colors.text },
  itemVariant: { ...typography.caption, color: colors.textMuted },
  itemPrice: { ...typography.bodyBold, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  bodyText: { ...typography.body, color: colors.text },
  historyRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", marginBottom: spacing.sm },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  error: { ...typography.body, color: colors.danger },
  cancelButton: { marginTop: spacing.xs },
});
