import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";
import { useLogout } from "@/api/hooks/use-auth";
import { colors, radius, spacing, typography } from "@/theme/theme";

export default function ProfileScreen() {
  const staff = useAuthStore((s) => s.staff);
  const logout = useLogout();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(staff?.email ?? "?").charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.email}>{staff?.email ?? "—"}</Text>
          <Text style={styles.permissionCount}>
            {staff?.permissions.length ?? 0} permission{staff?.permissions.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <View style={styles.menu}>
        <MenuRow icon="phone-portrait-outline" label="Your devices" onPress={() => router.push("/devices")} testID="menu-devices" />
      </View>

      <Pressable
        style={styles.logoutButton}
        onPress={() => logout.mutate(undefined, { onSuccess: () => router.replace("/(auth)/login") })}
        disabled={logout.isPending}
        testID="logout-button"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>{logout.isPending ? "Signing out…" : "Sign Out"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function MenuRow({ icon, label, onPress, testID }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress} testID={testID}>
      <Ionicons name={icon} size={20} color={colors.text} style={styles.menuIcon} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.h3, color: colors.onPrimary },
  email: { ...typography.bodyBold, color: colors.text },
  permissionCount: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  menu: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm },
  menuIcon: { width: 24 },
  menuLabel: { ...typography.body, color: colors.text, flex: 1 },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginTop: spacing.xl, padding: spacing.md },
  logoutText: { ...typography.bodyBold, color: colors.danger },
});
