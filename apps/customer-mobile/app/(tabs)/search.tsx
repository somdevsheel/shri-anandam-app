import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { CategoryTile } from "@/components/CategoryTile";
import { LoadingView } from "@/components/ui/LoadingView";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCategories, useProducts } from "@/api/hooks/use-catalog";
import { colors, fonts, radius, spacing, typography } from "@/theme/theme";

/** Debounces free-text search so useProducts doesn't refetch on every keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [term, setTerm] = useState(q ?? "");
  const debouncedTerm = useDebounced(term.trim(), 300);

  const categoriesQuery = useCategories();
  const resultsQuery = useProducts({ search: debouncedTerm || undefined });
  const results = debouncedTerm ? resultsQuery.data?.pages.flatMap((p) => p.items) ?? [] : [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.primary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search sweets, food, namkeen…"
          placeholderTextColor={colors.textMuted}
          value={term}
          onChangeText={setTerm}
          returnKeyType="search"
          autoFocus={!q}
          testID="search-input"
        />
      </View>

      {!debouncedTerm ? (
        <View style={styles.browsePrompt}>
          <Text style={styles.sectionTitle}>Browse by category</Text>
          {categoriesQuery.isLoading ? (
            <LoadingView />
          ) : (
            <FlatList
              data={categoriesQuery.data ?? []}
              keyExtractor={(c) => c.id}
              numColumns={3}
              columnWrapperStyle={styles.categoryRow}
              contentContainerStyle={styles.categoryGrid}
              renderItem={({ item }) => (
                <CategoryTile category={item} onPress={() => setTerm(item.name)} />
              )}
            />
          )}
        </View>
      ) : resultsQuery.isLoading ? (
        <LoadingView />
      ) : results.length === 0 ? (
        <EmptyState icon="search-outline" title="We couldn't find that" message="Try another sweet, dish, or category name." />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.resultsRow}
          contentContainerStyle={styles.resultsContent}
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    margin: spacing.lg,
    marginBottom: spacing.sm,
    height: 46,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 14, color: colors.text, height: "100%" },
  browsePrompt: { flex: 1, paddingHorizontal: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  categoryGrid: { paddingBottom: spacing.xl },
  categoryRow: { justifyContent: "flex-start", marginBottom: spacing.sm },
  resultsContent: { padding: spacing.lg, paddingTop: 0 },
  resultsRow: { justifyContent: "space-between" },
});
