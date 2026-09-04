import { useEffect } from "react";
import { FlatList, StyleSheet } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { ProductCard } from "@/components/ProductCard";
import { LoadingView } from "@/components/ui/LoadingView";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCategories, useProducts } from "@/api/hooks/use-catalog";
import { colors, spacing } from "@/theme/theme";

/**
 * Doubles as the free-text search results screen: Home's search bar
 * routes here with slug="all" (no category filter) plus a `search`
 * param, so there's one paginated/virtualized product list rather than
 * a near-duplicate search screen.
 */
export default function CategoryScreen() {
  const { slug, search } = useLocalSearchParams<{ slug: string; search?: string }>();
  const navigation = useNavigation();
  const { data: categories } = useCategories();
  const category = slug === "all" ? undefined : categories?.find((c) => c.slug === slug);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useProducts({
    categoryId: category?.id,
    search: search || undefined,
  });

  useEffect(() => {
    navigation.setOptions({ title: search ? `"${search}"` : (category?.name ?? "Products") });
  }, [navigation, search, category?.name]);

  const products = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) return <LoadingView />;

  if (products.length === 0) {
    return <EmptyState icon="search-outline" title="No products found" message="Try a different search or category." />;
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      style={{ backgroundColor: colors.background }}
      renderItem={({ item }) => <ProductCard product={item} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  row: { justifyContent: "space-between" },
});
