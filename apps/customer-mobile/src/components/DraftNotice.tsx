import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@/theme/theme";

/** Unmissable banner for content that isn't real legal advice yet — see app/legal/terms.tsx and app/legal/privacy.tsx. */
export function DraftNotice() {
  return (
    <View style={styles.container}>
      <Ionicons name="warning-outline" size={18} color={colors.warning} />
      <Text style={styles.text}>
        Draft — not reviewed by a lawyer. This page must be replaced with real, reviewed legal text before it's relied on.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.warningBackground,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  text: { ...typography.caption, color: "#8A5A10", flex: 1, lineHeight: 18 },
});
