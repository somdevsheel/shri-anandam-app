import { StyleSheet, Text, View } from "react-native";
import { formatInr } from "@shri-anandam/shared-types";
import { colors, spacing, typography } from "@/theme/theme";

interface PriceTagProps {
  priceInPaise: number;
  compareAtPriceInPaise?: number | null;
}

export function PriceTag({ priceInPaise, compareAtPriceInPaise }: PriceTagProps) {
  const hasDiscount = compareAtPriceInPaise != null && compareAtPriceInPaise > priceInPaise;

  return (
    <View style={styles.row}>
      <Text style={styles.price}>{formatInr(priceInPaise)}</Text>
      {hasDiscount ? <Text style={styles.compareAt}>{formatInr(compareAtPriceInPaise)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs },
  price: { ...typography.price, color: colors.text },
  compareAt: { ...typography.caption, color: colors.textMuted, textDecorationLine: "line-through" },
});
