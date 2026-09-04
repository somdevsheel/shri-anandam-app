import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDeactivateDevice, useDevices } from "@/api/hooks/use-devices";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import type { DeviceToken } from "@/api/types";
import { colors, radius, spacing, typography } from "@/theme/theme";
import { formatDateTime } from "@/lib/format";

const PLATFORM_ICON: Record<DeviceToken["platform"], keyof typeof Ionicons.glyphMap> = {
  ANDROID: "logo-android",
  IOS: "logo-apple",
  WEB: "desktop-outline",
};

/** Device management (section 19/22) — every device this staff account has registered for push, with the ability to log one out remotely. */
export default function DevicesScreen() {
  const { data: devices, isLoading, error } = useDevices();
  const deactivate = useDeactivateDevice();

  const confirmDeactivate = (device: DeviceToken) => {
    Alert.alert("Log out this device?", "It will stop receiving push notifications until it registers again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => deactivate.mutate(device.id) },
    ]);
  };

  if (isLoading) return <LoadingView />;
  if (error) return <EmptyState icon="alert-circle-outline" title="Couldn't load devices" />;

  return (
    <FlatList
      data={devices ?? []}
      keyExtractor={(d) => d.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={<EmptyState icon="phone-portrait-outline" title="No devices registered" message="Push notifications need a device to be registered from this app first." />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Ionicons name={PLATFORM_ICON[item.platform]} size={22} color={colors.text} style={styles.rowIcon} />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>
              {item.platform} · {item.appType}
            </Text>
            <Text style={styles.rowSubtitle}>Last active {formatDateTime(item.lastActiveAt)}</Text>
          </View>
          <Pressable onPress={() => confirmDeactivate(item)} style={styles.logoutButton} testID={`deactivate-device-${item.id}`}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.lg, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  rowIcon: {},
  rowBody: { flex: 1 },
  rowTitle: { ...typography.bodyBold, color: colors.text },
  rowSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  logoutButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  logoutText: { ...typography.bodyBold, color: colors.danger },
});
