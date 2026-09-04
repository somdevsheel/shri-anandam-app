import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMarkNotificationRead, useNotifications } from "@/api/hooks/use-notifications";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import type { Notification } from "@/api/types";
import { colors, radius, spacing, typography } from "@/theme/theme";
import { formatDateTime } from "@/lib/format";

/** Notification history (section 19) — every push this device was ever sent, independent of whether it actually arrived (services/notification-worker writes this row before attempting FCM delivery). */
export default function NotificationsScreen() {
  const { data, isLoading, isRefetching, refetch, error } = useNotifications({ pageSize: 30 });
  const markRead = useMarkNotificationRead();

  const handlePress = (notification: Notification) => {
    if (notification.status !== "READ") markRead.mutate(notification.id);
    if (notification.entityType === "Order" && notification.entityId) {
      router.push(`/order/${notification.entityId}`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Alerts</Text>

      {isLoading ? (
        <LoadingView />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load notifications" message="Pull down to try again." />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
          renderItem={({ item }) => <NotificationRow notification={item} onPress={() => handlePress(item)} />}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="No notifications yet" />}
        />
      )}
    </SafeAreaView>
  );
}

function NotificationRow({ notification, onPress }: { notification: Notification; onPress: () => void }) {
  const isUnread = notification.status !== "READ";
  return (
    <Pressable style={[styles.row, isUnread && styles.rowUnread]} onPress={onPress} testID={`notification-${notification.id}`}>
      <View style={styles.rowIcon}>
        <Ionicons
          name={notification.type === "InventoryLow" ? "cube-outline" : "receipt-outline"}
          size={20}
          color={isUnread ? colors.primary : colors.textMuted}
        />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, isUnread && styles.rowTitleUnread]}>{notification.title}</Text>
        <Text style={styles.rowText}>{notification.body}</Text>
        <Text style={styles.rowTime}>{formatDateTime(notification.createdAt)}</Text>
      </View>
      {isUnread ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  row: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  rowUnread: { borderColor: colors.primary },
  rowIcon: { paddingTop: 2 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.bodyBold, color: colors.text },
  rowTitleUnread: { color: colors.primary },
  rowText: { ...typography.body, color: colors.textMuted },
  rowTime: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
});
