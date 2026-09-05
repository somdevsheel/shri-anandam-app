import { StyleSheet, Text, View } from "react-native";
import { OrderStatus, ORDER_STATUS_FLOW, TERMINAL_ORDER_STATUSES } from "@shri-anandam/shared-types";
import { colors, fonts, spacing } from "@/theme/theme";
import { formatDateTime } from "@/lib/format";
import type { Order } from "@/api/types";

const STEP_LABEL: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.PENDING]: "Order placed",
  [OrderStatus.ACCEPTED]: "Confirmed",
  [OrderStatus.PREPARING]: "Preparing",
  [OrderStatus.READY]: "Ready",
  [OrderStatus.OUT_FOR_DELIVERY]: "Out for delivery",
};

interface OrderTimelineProps {
  order: Order;
}

/** The order lifecycle as a vertical timeline — steps come from shared-types' ORDER_STATUS_FLOW (the same state machine services/api enforces), not a UI-only guess at what "should" happen next. */
export function OrderTimeline({ order }: OrderTimelineProps) {
  // Order.status comes typed as a plain `string` from api/types.ts (it's a
  // hand-written mirror of the API response, not the enum itself) —
  // narrowing it here is safe since services/api only ever sends one of
  // shared-types' OrderStatus values.
  const status = order.status as OrderStatus;

  if (TERMINAL_ORDER_STATUSES.has(status) && status !== OrderStatus.DELIVERED) {
    // REJECTED / CANCELLED left the happy path entirely — a stepped
    // progress bar would misrepresent that, so show it as its own state.
    return (
      <View style={styles.container}>
        <View style={[styles.dot, { backgroundColor: colors.danger }]} />
        <View style={styles.stepBody}>
          <Text style={[styles.stepTitle, { color: colors.danger }]}>
            {status === OrderStatus.REJECTED ? "Order rejected" : "Order cancelled"}
          </Text>
          {order.statusHistory[order.statusHistory.length - 1]?.reason ? (
            <Text style={styles.stepNote}>{order.statusHistory[order.statusHistory.length - 1]?.reason}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  const steps = ORDER_STATUS_FLOW.filter((s) => order.fulfillmentType !== "PICKUP" || s !== OrderStatus.OUT_FOR_DELIVERY);
  const currentIndex = steps.indexOf(status);
  const historyByStatus = new Map(order.statusHistory.map((entry) => [entry.newStatus, entry.createdAt]));

  return (
    <View style={styles.list}>
      {steps.map((status, i) => {
        const done = currentIndex >= 0 ? i < currentIndex : false;
        const current = i === currentIndex;
        const reachedAt = historyByStatus.get(status) ?? (status === OrderStatus.PENDING ? order.placedAt : undefined);
        const label = status === OrderStatus.DELIVERED ? (order.fulfillmentType === "PICKUP" ? "Picked up" : "Delivered") : STEP_LABEL[status];
        return (
          <View key={status} style={styles.container}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  done || current ? { backgroundColor: done ? colors.primary : colors.surface, borderColor: colors.primary } : { borderColor: colors.border },
                ]}
              />
              {i < steps.length - 1 ? (
                <View style={[styles.line, { backgroundColor: done ? colors.primary : colors.border }]} />
              ) : null}
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepTitle, { color: done || current ? colors.text : colors.disabled }]}>{label}</Text>
              {reachedAt ? <Text style={styles.stepNote}>{formatDateTime(reachedAt)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {},
  container: { flexDirection: "row", gap: spacing.sm },
  rail: { alignItems: "center", width: 20 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, backgroundColor: colors.surface },
  line: { flex: 1, width: 2, minHeight: 22 },
  stepBody: { flex: 1, paddingBottom: spacing.md },
  stepTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, fontWeight: "600" },
  stepNote: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
