import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { formatInr } from "@shri-anandam/shared-types";
import { useOrders } from "@/api/hooks/use-orders";
import { useRealtimeOrders } from "@/api/use-realtime";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import { colors, radius, spacing, typography } from "@/theme/theme";
import { formatDateTime } from "@/lib/format";
import type { Order } from "@/api/types";

export default function OrdersScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useOrders();
  useRealtimeOrders(() => void refetch());

  if (isLoading) return <LoadingView />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Your orders</Text>

      {error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load your orders" message="Pull down to try again." />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No orders yet" message="Your order history will show up here." />
      ) : (
        <FlatList
          data={data.items}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => <OrderRow order={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function OrderRow({ order }: { order: Order }) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/order/${order.id}`)} testID={`order-row-${order.id}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <StatusBadge status={order.status} />
      </View>
      <Text style={styles.meta}>
        {itemCount} item{itemCount === 1 ? "" : "s"} · {formatDateTime(order.placedAt)}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.total}>{formatInr(order.totalInPaise)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.display, fontSize: 22, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, marginBottom: spacing.sm },
  listContent: { padding: spacing.lg, paddingTop: 0, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderNumber: { ...typography.bodyBold, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  total: { ...typography.price, color: colors.text },
});
