import { StyleSheet, View } from "react-native";
import { colors } from "@/theme/theme";

interface VegIndicatorProps {
  isVeg: boolean;
  size?: number;
}

/** The standard Indian square-with-a-dot veg (green) / non-veg (brown) mark. */
export function VegIndicator({ isVeg, size = 15 }: VegIndicatorProps) {
  const tint = isVeg ? colors.success : colors.nonVeg;
  return (
    <View
      style={[styles.square, { width: size, height: size, borderColor: tint }]}
      accessibilityLabel={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <View style={[styles.dot, { backgroundColor: tint, width: size * 0.4, height: size * 0.4, borderRadius: size * 0.4 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    borderWidth: 1.5,
    borderRadius: 3,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {},
});
