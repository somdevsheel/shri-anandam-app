import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OrderStatus } from "@shri-anandam/shared-types";
import { useOrders } from "@/api/hooks/use-orders";
import { OrderCard } from "@/components/OrderCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import { colors, radius, spacing, typography } from "@/theme/theme";

const TERMINAL = new Set<string>([OrderStatus.DELIVERED, OrderStatus.REJECTED, OrderStatus.CANCELLED]);

/**
 * Pending/today's orders — the screen a staff member opens first
 * (section 19). The admin orders endpoint only supports a single-status
 * filter server-side (listOrdersAdminQuerySchema), so "Active" is a
 * client-side filter over a page of recent orders rather than a
 * server-side OR — fine at this scale; a dedicated "active orders" query
 * param is a reasonable Phase 9/backend follow-up if order volume ever
 * makes that page too large.
 */
export default function OrdersScreen() {
  const [filter, setFilter] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const { data, isLoading, isRefetching, refetch, error } = useOrders({ pageSize: 50 });

  const orders = useMemo(() => {
    const items = data?.items ?? [];
    return filter === "ACTIVE" ? items.filter((o) => !TERMINAL.has(o.status)) : items;
  }, [data, filter]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <View style={styles.filterRow}>
          <FilterPill label="Active" active={filter === "ACTIVE"} onPress={() => setFilter("ACTIVE")} />
          <FilterPill label="All" active={filter === "ALL"} onPress={() => setFilter("ALL")} />
        </View>
      </View>

      {isLoading ? (
        <LoadingView />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load orders" message="Pull down to try again." />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OrderCard order={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={filter === "ACTIVE" ? "No active orders" : "No orders yet"}
              message={filter === "ACTIVE" ? "New orders will show up here." : undefined}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  filterRow: { flexDirection: "row", gap: spacing.sm },
  pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { ...typography.bodyBold, color: colors.textMuted },
  pillTextActive: { color: colors.onPrimary },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
});
