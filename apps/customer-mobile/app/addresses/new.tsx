import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { createCustomerAddressSchema, type CreateCustomerAddressDto } from "@shri-anandam/validation";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useCreateAddress } from "@/api/hooks/use-customer";
import { ApiError } from "@/api/client";
import { colors, spacing } from "@/theme/theme";

type FormState = Partial<Record<keyof CreateCustomerAddressDto, string>>;

export default function NewAddressScreen() {
  const [form, setForm] = useState<FormState>({});
  const [errors, setErrors] = useState<Partial<Record<keyof CreateCustomerAddressDto, string>>>({});
  const createAddress = useCreateAddress();

  const setField = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    const candidate = {
      label: form.label,
      contactName: form.contactName ?? "",
      contactPhone: form.contactPhone ?? "",
      line1: form.line1 ?? "",
      line2: form.line2,
      city: form.city ?? "",
      state: form.state ?? "",
      pincode: form.pincode ?? "",
      isDefault: false,
    };

    const result = createCustomerAddressSchema.safeParse(candidate);
    if (!result.success) {
      const nextErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof CreateCustomerAddressDto;
        nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    createAddress.mutate(result.data, {
      onSuccess: () => router.back(),
      onError: (err) => {
        if (err instanceof ApiError) setErrors((e) => ({ ...e, line1: err.message }));
      },
    });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <TextField label="Label (optional)" placeholder="Home, Work..." value={form.label ?? ""} onChangeText={(v) => setField("label", v)} />
        <TextField
          label="Contact name"
          value={form.contactName ?? ""}
          onChangeText={(v) => setField("contactName", v)}
          error={errors.contactName}
        />
        <TextField
          label="Contact phone"
          placeholder="+919876543210"
          keyboardType="phone-pad"
          value={form.contactPhone ?? ""}
          onChangeText={(v) => setField("contactPhone", v)}
          error={errors.contactPhone}
        />
        <TextField
          label="Address line 1"
          value={form.line1 ?? ""}
          onChangeText={(v) => setField("line1", v)}
          error={errors.line1}
        />
        <TextField label="Address line 2 (optional)" value={form.line2 ?? ""} onChangeText={(v) => setField("line2", v)} />
        <TextField label="City" value={form.city ?? ""} onChangeText={(v) => setField("city", v)} error={errors.city} />
        <TextField label="State" value={form.state ?? ""} onChangeText={(v) => setField("state", v)} error={errors.state} />
        <TextField
          label="PIN code"
          keyboardType="number-pad"
          maxLength={6}
          value={form.pincode ?? ""}
          onChangeText={(v) => setField("pincode", v)}
          error={errors.pincode}
        />

        <Button label="Save address" onPress={handleSave} loading={createAddress.isPending} testID="save-address-button" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
});
