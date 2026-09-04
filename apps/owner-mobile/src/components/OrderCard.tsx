import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { Order } from "@/api/types";
import { StatusBadge } from "./StatusBadge";
import { colors, radius, spacing, typography } from "@/theme/theme";
import { formatInr, formatTime } from "@/lib/format";

export function OrderCard({ order }: { order: Order }) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/order/${order.id}`)}
      testID={`order-card-${order.id}`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <StatusBadge status={order.status} />
      </View>

      <View style={styles.metaRow}>
        <Ionicons
          name={order.fulfillmentType === "PICKUP" ? "storefront-outline" : "bicycle-outline"}
          size={14}
          color={colors.textMuted}
        />
        <Text style={styles.metaText}>{order.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery"}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{formatTime(order.placedAt)}</Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.total}>{formatInr(order.totalInPaise)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.85 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderNumber: { ...typography.bodyBold, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textMuted },
  metaDot: { color: colors.textMuted },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  total: { ...typography.price, color: colors.text },
});
