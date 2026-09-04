import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OrderStatus } from "@shri-anandam/shared-types";
import { useOrders } from "@/api/hooks/use-orders";
import { OrderCard } from "@/components/OrderCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import { colors, radius, spacing, typography } from "@/theme/theme";

const FILTERS = [
  { label: "All", value: undefined },
  { label: "Delivered", value: OrderStatus.DELIVERED },
  { label: "Cancelled", value: OrderStatus.CANCELLED },
  { label: "Rejected", value: OrderStatus.REJECTED },
] as const;

/** Past orders (section 19's "order history") — server-side status filter, most recent first. */
export default function HistoryScreen() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const { data, isLoading, isRefetching, refetch, error } = useOrders({ status, pageSize: 30 });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Order History</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.label}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <Pressable style={[styles.pill, status === item.value && styles.pillActive]} onPress={() => setStatus(item.value)}>
              <Text style={[styles.pillText, status === item.value && styles.pillTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
      </View>

      {isLoading ? (
        <LoadingView />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load orders" message="Pull down to try again." />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OrderCard order={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="archive-outline" title="No orders found" />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  filterRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { ...typography.bodyBold, color: colors.textMuted },
  pillTextActive: { color: colors.onPrimary },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
});
