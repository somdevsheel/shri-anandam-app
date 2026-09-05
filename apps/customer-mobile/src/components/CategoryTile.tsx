import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { colors, fonts, radius, spacing } from "@/theme/theme";
import type { Category } from "@/api/types";

interface CategoryTileProps {
  category: Category;
  onPress: () => void;
}

/** Home's "Shop by category" rail — a square image tile with the name below, falling back to an initial when the category has no image yet. */
export function CategoryTile({ category, onPress }: CategoryTileProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={category.name} style={styles.container}>
      <View style={styles.tile}>
        {category.imageUrl ? (
          <Image source={{ uri: category.imageUrl }} style={styles.image} contentFit="cover" />
        ) : (
          <Text style={styles.initial}>{category.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {category.name}
      </Text>
    </Pressable>
  );
}

const TILE_SIZE = 76;

const styles = StyleSheet.create({
  container: { width: TILE_SIZE + 12, alignItems: "center", gap: spacing.xs, marginRight: spacing.sm },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  initial: { fontFamily: fonts.display, fontSize: 26, color: colors.primary },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 12, fontWeight: "600", color: colors.text, textAlign: "center" },
});
