import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, spacing, typography } from "@/theme/theme";

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
  },
  inputError: { borderColor: colors.danger },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});
