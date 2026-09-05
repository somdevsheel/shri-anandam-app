import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { LoadingView } from "@/components/ui/LoadingView";
import { useProfile, useUpdateProfile } from "@/api/hooks/use-customer";
import { useLogout } from "@/api/hooks/use-auth";
import { useNotifications } from "@/api/hooks/use-notifications";
import { ApiError } from "@/api/client";
import { colors, fonts, radius, spacing, typography } from "@/theme/theme";

function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function ProfileScreen() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();
  const { data: notificationsData } = useNotifications();
  const unreadCount = notificationsData?.items.filter((n) => !n.readAt).length ?? 0;

  const [name, setName] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  if (isLoading || !profile) return <LoadingView />;

  const displayName = name ?? profile.name ?? "";
  const displayEmail = email ?? profile.email ?? "";
  const isDirty = (name !== undefined && name !== (profile.name ?? "")) || (email !== undefined && email !== (profile.email ?? ""));

  const handleSave = () => {
    setError(undefined);
    updateProfile.mutate(
      { name: displayName || undefined, email: displayEmail || undefined },
      {
        onSuccess: () => {
          setName(undefined);
          setEmail(undefined);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save changes"),
      },
    );
  };

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => logout.mutate(undefined, { onSuccess: () => router.replace("/onboarding") }),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(profile.name)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{profile.name || "Your profile"}</Text>
            <Text style={styles.mobileNumber}>{profile.mobileNumber}</Text>
          </View>
        </View>

        <View style={styles.linkGroup}>
          <ProfileRow icon="location-outline" label="Saved addresses" onPress={() => router.push("/addresses")} />
          <View style={styles.linkDivider} />
          <ProfileRow icon="receipt-outline" label="Order history" onPress={() => router.push("/orders")} />
          <View style={styles.linkDivider} />
          <ProfileRow
            icon="notifications-outline"
            label="Notifications"
            meta={unreadCount > 0 ? String(unreadCount) : undefined}
            onPress={() => router.push("/notifications")}
          />
          <View style={styles.linkDivider} />
          <ProfileRow icon="call-outline" label="Help & support" onPress={() => router.push("/help")} />
        </View>

        <View style={styles.linkGroup}>
          <ProfileRow icon="document-text-outline" label="Terms of Service" onPress={() => router.push("/legal/terms")} />
          <View style={styles.linkDivider} />
          <ProfileRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push("/legal/privacy")} />
        </View>

        <Text style={styles.sectionTitle}>Edit details</Text>
        <TextField label="Name" placeholder="Your name" value={displayName} onChangeText={setName} />
        <TextField
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={displayEmail}
          onChangeText={setEmail}
          error={error}
        />
        {isDirty ? <Button label="Save changes" onPress={handleSave} loading={updateProfile.isPending} /> : null}

        <View style={styles.spacer} />
        <Button label="Log out" onPress={handleLogout} variant="danger" loading={logout.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileRow({
  icon,
  label,
  meta,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  meta?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.linkRow} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={19} color={colors.text} />
      <Text style={styles.linkText}>{label}</Text>
      {meta ? (
        <View style={styles.linkBadge}>
          <Text style={styles.linkBadgeText}>{meta}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.maroon,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 19, fontWeight: "700", color: colors.accentOnMaroon },
  name: { ...typography.display, fontSize: 20, color: colors.text },
  mobileNumber: { ...typography.body, color: colors.textMuted, marginTop: 2 },
  linkGroup: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  linkDivider: { height: 1, backgroundColor: colors.border },
  linkBadge: { minWidth: 20, height: 20, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  linkBadgeText: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: "700", color: colors.onPrimary },
  linkText: { ...typography.bodyBold, color: colors.text, flex: 1 },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  spacer: { height: spacing.xl },
});
