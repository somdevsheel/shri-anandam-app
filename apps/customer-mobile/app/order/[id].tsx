import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatInr, OrderStatus } from "@shri-anandam/shared-types";
import { useCancelOrder, useOrder } from "@/api/hooks/use-orders";
import { useRealtimeOrders } from "@/api/use-realtime";
import { ApiError } from "@/api/client";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderTimeline } from "@/components/OrderTimeline";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import { colors, fonts, radius, spacing, typography } from "@/theme/theme";
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
  const navigation = useNavigation();
  const { data: order, isLoading, error, refetch } = useOrder(id);
  const cancelOrder = useCancelOrder(id ?? "");
  const [cancelError, setCancelError] = useState<string | null>(null);

  useRealtimeOrders(() => void refetch());

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{canCancel ? "Tracking your order" : "Order details"}</Text>
            <Text style={styles.headerMeta}>
              #{order.orderNumber} · {formatDateTime(order.placedAt)}
            </Text>
          </View>
          <StatusBadge status={order.status} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <OrderTimeline order={order} />
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

        {cancelError ? <Text style={styles.error}>{cancelError}</Text> : null}
        {canCancel ? (
          <Button label="Cancel Order" variant="danger" onPress={handleCancel} loading={cancelOrder.isPending} style={styles.cancelButton} />
        ) : null}
        <Button label="Back to Orders" variant="outline" onPress={() => router.replace("/orders")} style={styles.cancelButton} />
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
  header: { backgroundColor: colors.maroon, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { ...typography.display, fontSize: 20, color: colors.background },
  headerMeta: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accentOnMaroon, marginTop: 5 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
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
  error: { ...typography.body, color: colors.danger },
  cancelButton: { marginTop: spacing.xs },
});
