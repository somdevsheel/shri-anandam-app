import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useRequestOtp, useVerifyOtp } from "@/api/hooks/use-auth";
import { ApiError } from "@/api/client";
import { colors, spacing, typography } from "@/theme/theme";

const RESEND_COOLDOWN_SECONDS = 30; // matches OTP_RESEND_COOLDOWN_SECONDS in services/api/.env.example

export default function OtpVerifyScreen() {
  const { mobileNumber } = useLocalSearchParams<{ mobileNumber: string }>();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const verifyOtp = useVerifyOtp();
  const requestOtp = useRequestOtp();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = () => {
    if (!mobileNumber) return;
    setError(undefined);
    verifyOtp.mutate(
      { mobileNumber, otp },
      {
        onSuccess: () => router.replace("/(tabs)/home"),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Verification failed. Try again."),
      },
    );
  };

  const handleResend = () => {
    if (!mobileNumber || cooldown > 0) return;
    requestOtp.mutate({ mobileNumber }, { onSuccess: () => setCooldown(RESEND_COOLDOWN_SECONDS) });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.heading}>Enter the code</Text>
      <Text style={styles.subheading}>Sent to +91 {mobileNumber?.replace("+91", "")}</Text>

      <TextField
        placeholder="6-digit code"
        keyboardType="number-pad"
        maxLength={8}
        value={otp}
        onChangeText={(text) => setOtp(text.replace(/\D/g, ""))}
        error={error}
        autoFocus
        testID="otp-input"
      />

      <Button label="Verify" onPress={handleVerify} loading={verifyOtp.isPending} disabled={otp.length < 4} testID="verify-otp-button" />

      <Button
        label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        onPress={handleResend}
        variant="outline"
        disabled={cooldown > 0}
        loading={requestOtp.isPending}
        style={styles.resendButton}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: spacing.xl },
  heading: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subheading: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  resendButton: { marginTop: spacing.md },
});
