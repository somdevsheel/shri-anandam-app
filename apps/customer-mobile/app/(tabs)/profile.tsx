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
import { ApiError } from "@/api/client";
import { colors, radius, spacing, typography } from "@/theme/theme";

export default function ProfileScreen() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();

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
        <Text style={styles.heading}>Your profile</Text>
        <Text style={styles.mobileNumber}>{profile.mobileNumber}</Text>

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

        <Pressable style={styles.linkRow} onPress={() => router.push("/addresses")} accessibilityRole="button">
          <Ionicons name="location-outline" size={20} color={colors.text} />
          <Text style={styles.linkText}>Saved addresses</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <View style={styles.spacer} />
        <Button label="Log out" onPress={handleLogout} variant="danger" loading={logout.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  heading: { ...typography.h2, color: colors.text },
  mobileNumber: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  linkText: { ...typography.bodyBold, color: colors.text, flex: 1 },
  spacer: { height: spacing.xl },
});
