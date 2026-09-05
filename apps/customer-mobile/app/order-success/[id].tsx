import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatInr } from "@shri-anandam/shared-types";
import { useOrder } from "@/api/hooks/use-orders";
import { Button } from "@/components/ui/Button";
import { LoadingView } from "@/components/ui/LoadingView";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors, fonts, radius, spacing, typography } from "@/theme/theme";
import { formatDateTime } from "@/lib/format";

const PAID_STATUSES = new Set(["PAID", "CAPTURED", "SUCCEEDED"]);

/** Shown once, right after checkout places an order — before the customer moves on to the live tracking screen (app/order/[id].tsx). */
export default function OrderSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading } = useOrder(id);

  if (isLoading) return <LoadingView />;
  if (!order) return <EmptyState icon="alert-circle-outline" title="Couldn't load this order" />;

  const latestPayment = order.payments[order.payments.length - 1];
  const isPaid = latestPayment ? PAID_STATUSES.has(latestPayment.status) : false;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.body}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={30} color={colors.onPrimary} />
        </View>
        <Text style={styles.title}>Order placed</Text>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Placed at</Text>
            <Text style={styles.summaryValue}>{formatDateTime(order.placedAt)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount</Text>
            <Text style={styles.summaryValue}>{formatInr(order.totalInPaise)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment</Text>
            <View style={[styles.paymentBadge, { backgroundColor: isPaid ? "#E4F0E5" : colors.warningBackground }]}>
              <Text style={[styles.paymentBadgeText, { color: isPaid ? colors.success : colors.warning }]}>
                {latestPayment ? (isPaid ? "Paid online" : latestPayment.status.replace(/_/g, " ")) : "Pay on " + (order.fulfillmentType === "PICKUP" ? "pickup" : "delivery")}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button label="Track order" onPress={() => router.replace(`/order/${order.id}`)} testID="track-order-button" />
        <Button label="Continue shopping" variant="outline" onPress={() => router.replace("/(tabs)/home")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  checkCircle: {
    width: 78,
    height: 78,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.display, fontSize: 24, color: colors.text, marginTop: spacing.lg },
  orderNumber: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  summaryCard: {
    width: "100%",
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { ...typography.body, color: colors.textMuted },
  summaryValue: { ...typography.bodyBold, color: colors.text },
  paymentBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  paymentBadgeText: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  footer: { padding: spacing.lg, gap: spacing.sm },
});
