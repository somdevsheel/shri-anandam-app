import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { staffLoginSchema } from "@shri-anandam/validation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useStaffLogin } from "@/api/hooks/use-auth";
import { ApiError } from "@/api/client";
import { colors, spacing, typography } from "@/theme/theme";

/**
 * Staff login is email + password (ADR-003), not the customer app's OTP
 * flow — a fundamentally different auth mechanism, not just a different
 * screen, which is why this app has its own (auth) stack rather than
 * sharing apps/customer-mobile's.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const login = useStaffLogin();

  const handleLogin = () => {
    const result = staffLoginSchema.safeParse({ email: email.trim(), password });
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === "email") fieldErrors.email = issue.message;
        if (field === "password") fieldErrors.password = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    login.mutate(result.data, {
      onSuccess: () => router.replace("/(tabs)/orders"),
      onError: (err) => {
        setErrors({
          form: err instanceof ApiError ? err.message : "Could not sign in. Check your connection and try again.",
        });
      },
    });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Text style={styles.brand}>Shri Anandam</Text>
        <Text style={styles.heading}>Staff Sign In</Text>
        <Text style={styles.subheading}>Manage orders, inventory alerts, and more.</Text>
      </View>

      <TextField
        label="Email"
        placeholder="you@shrianandam.local"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        testID="login-email-input"
      />
      <TextField
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        testID="login-password-input"
      />

      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

      <Button label="Sign In" onPress={handleLogin} loading={login.isPending} testID="login-submit-button" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: "center" },
  header: { marginBottom: spacing.xl },
  brand: { ...typography.caption, color: colors.primary, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  heading: { ...typography.h1, color: colors.text, marginTop: spacing.xs },
  subheading: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  formError: { ...typography.body, color: colors.danger, marginBottom: spacing.md },
});
