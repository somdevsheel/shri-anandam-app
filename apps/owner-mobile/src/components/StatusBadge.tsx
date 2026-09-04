import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography, STATUS_COLORS } from "@/theme/theme";

function humanize(status: string): string {
  return status
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{humanize(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  text: { ...typography.caption, fontWeight: "700" },
});
