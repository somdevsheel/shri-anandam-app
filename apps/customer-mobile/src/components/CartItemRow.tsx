import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatInr } from "@shri-anandam/shared-types";
import { colors, radius, spacing, typography } from "@/theme/theme";
import type { CartItemLine } from "@/api/types";

interface CartItemRowProps {
  item: CartItemLine;
  issueMessage?: string;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  isUpdating?: boolean;
}

export function CartItemRow({ item, issueMessage, onIncrement, onDecrement, onRemove, isUpdating }: CartItemRowProps) {
  return (
    <View style={[styles.container, issueMessage && styles.containerWithIssue]}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.product.name}</Text>
        <Text style={styles.variant}>{item.variant.name}</Text>
        {item.addons.length > 0 ? (
          <Text style={styles.addons}>+ {item.addons.map((a) => a.name).join(", ")}</Text>
        ) : null}
        {issueMessage ? <Text style={styles.issue}>{issueMessage}</Text> : null}
      </View>

      <View style={styles.controls}>
        <Text style={styles.lineTotal}>{formatInr(item.lineTotalInPaise)}</Text>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
            onPress={onDecrement}
            disabled={isUpdating}
            style={styles.stepperButton}
          >
            <Ionicons name={item.quantity <= 1 ? "trash-outline" : "remove"} size={16} color={colors.primary} />
          </Pressable>
          <Text style={styles.quantity}>{item.quantity}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
            onPress={onIncrement}
            disabled={isUpdating}
            style={styles.stepperButton}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove item" onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerWithIssue: { borderColor: colors.warning },
  info: { flex: 1, marginRight: spacing.sm },
  name: { ...typography.bodyBold, color: colors.text },
  variant: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  addons: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  issue: { ...typography.caption, color: colors.warning, marginTop: spacing.xs, fontWeight: "600" },
  controls: { alignItems: "flex-end", gap: spacing.xs },
  lineTotal: { ...typography.bodyBold, color: colors.text },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  quantity: { ...typography.bodyBold, color: colors.text, minWidth: 18, textAlign: "center" },
});
