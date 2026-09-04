import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { mobileNumberSchema } from "@shri-anandam/validation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useRequestOtp } from "@/api/hooks/use-auth";
import { ApiError } from "@/api/client";
import { colors, spacing, typography } from "@/theme/theme";

export default function MobileNumberScreen() {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | undefined>();
  const requestOtp = useRequestOtp();

  const mobileNumber = `+91${digits}`;

  const handleContinue = () => {
    const result = mobileNumberSchema.safeParse(mobileNumber);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid mobile number");
      return;
    }
    setError(undefined);

    requestOtp.mutate(
      { mobileNumber },
      {
        onSuccess: () => router.push({ pathname: "/(auth)/otp-verify", params: { mobileNumber } }),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not send OTP. Try again."),
      },
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.heading}>What's your mobile number?</Text>
      <Text style={styles.subheading}>We'll send you a one-time code to verify.</Text>

      <View style={styles.inputRow}>
        <View style={styles.prefixBox}>
          <Text style={styles.prefixText}>+91</Text>
        </View>
        <View style={styles.inputFlex}>
          <TextField
            placeholder="98765 43210"
            keyboardType="number-pad"
            maxLength={10}
            value={digits}
            onChangeText={(text) => setDigits(text.replace(/\D/g, ""))}
            error={error}
            autoFocus
            testID="mobile-number-input"
          />
        </View>
      </View>

      <Button
        label="Send OTP"
        onPress={handleContinue}
        loading={requestOtp.isPending}
        disabled={digits.length !== 10}
        testID="send-otp-button"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: spacing.xl },
  heading: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subheading: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  inputRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  prefixBox: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  prefixText: { ...typography.bodyBold, color: colors.text },
  inputFlex: { flex: 1 },
});
