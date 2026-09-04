import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@/theme/theme";
import type { CustomerAddress } from "@/api/types";

interface AddressCardProps {
  address: CustomerAddress;
  onPress?: () => void;
  onSetDefault?: () => void;
  onDelete?: () => void;
  selected?: boolean;
}

export function AddressCard({ address, onPress, onSetDefault, onDelete, selected }: AddressCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={styles.header}>
        <Text style={styles.label}>{address.label || "Address"}</Text>
        {address.isDefault ? (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name}>{address.contactName}</Text>
      <Text style={styles.line}>
        {address.line1}
        {address.line2 ? `, ${address.line2}` : ""}
      </Text>
      <Text style={styles.line}>
        {address.city}, {address.state} {address.pincode}
      </Text>
      <Text style={styles.line}>{address.contactPhone}</Text>

      {(onSetDefault || onDelete) && (
        <View style={styles.actions}>
          {onSetDefault && !address.isDefault ? (
            <Pressable onPress={onSetDefault} accessibilityRole="button" style={styles.actionButton}>
              <Text style={styles.actionText}>Set as default</Text>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable onPress={onDelete} accessibilityRole="button" style={styles.actionButton}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.actionText, { color: colors.danger }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardSelected: { borderColor: colors.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  label: { ...typography.bodyBold, color: colors.text },
  defaultBadge: { backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  defaultBadgeText: { ...typography.caption, color: colors.onPrimary, fontWeight: "700" },
  name: { ...typography.body, color: colors.text, marginBottom: 2 },
  line: { ...typography.caption, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { ...typography.caption, color: colors.primary, fontWeight: "600" },
});
