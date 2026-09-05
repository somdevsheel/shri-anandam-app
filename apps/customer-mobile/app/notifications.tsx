import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMarkNotificationRead, useNotifications } from "@/api/hooks/use-notifications";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import { colors, fonts, radius, spacing, typography } from "@/theme/theme";
import { formatDateTime } from "@/lib/format";
import type { AppNotification } from "@/api/types";

/** Real notification history — GET /notifications + mark-as-read already existed for the owner app (services/api/src/notifications); this is the customer app's first use of it. No preferences toggle: there's no server-side preference field to back one. */
export default function NotificationsScreen() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();

  if (isLoading) return <LoadingView />;

  const items = data?.items ?? [];

  const handlePress = (notification: AppNotification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    if (notification.entityType === "ORDER" && notification.entityId) {
      router.push(`/order/${notification.entityId}`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {items.length === 0 ? (
        <EmptyState icon="notifications-outline" title="No notifications yet" message="Order updates will show up here." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item)}
              style={[styles.row, !item.readAt && styles.rowUnread]}
              accessibilityRole="button"
            >
              {!item.readAt ? <View style={styles.unreadDot} /> : <View style={styles.unreadDotSpacer} />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, !item.readAt && styles.titleUnread]}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowUnread: { borderColor: colors.primary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  unreadDotSpacer: { width: 8 },
  title: { ...typography.bodyBold, color: colors.text },
  titleUnread: { fontFamily: fonts.sansBold, fontWeight: "700" },
  body: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  time: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, fontSize: 11 },
});
