import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme/theme";

const STATUS_COLORS: Record<string, string> = {
  PENDING: colors.warning,
  ACCEPTED: colors.primary,
  PREPARING: colors.primary,
  READY: colors.success,
  OUT_FOR_DELIVERY: colors.success,
  DELIVERED: colors.textMuted,
  REJECTED: colors.danger,
  CANCELLED: colors.danger,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Order Placed",
  ACCEPTED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: color + "1A", borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  text: { ...typography.caption, fontWeight: "700" },
});
