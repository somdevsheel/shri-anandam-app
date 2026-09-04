import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TextField } from "@/components/ui/TextField";
import { CategoryChip } from "@/components/CategoryChip";
import { ProductCard } from "@/components/ProductCard";
import { LoadingView } from "@/components/ui/LoadingView";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCategories, useProducts } from "@/api/hooks/use-catalog";
import { colors, spacing, typography } from "@/theme/theme";

export default function HomeScreen() {
  const [searchText, setSearchText] = useState("");
  const categoriesQuery = useCategories();
  const featuredQuery = useProducts({ isFeatured: true });
  const popularQuery = useProducts({});

  const submitSearch = () => {
    if (searchText.trim().length === 0) return;
    router.push({ pathname: "/category/all", params: { search: searchText.trim() } });
  };

  const featured = featuredQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const popular = popularQuery.data?.pages.flatMap((p) => p.items).slice(0, 6) ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.brand}>Shri Anandam</Text>
        <Text style={styles.tagline}>Sweets & Restaurant</Text>

        <TextField
          placeholder="Search for sweets, namkeen, gift packs..."
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
          testID="home-search-input"
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
        </View>
        {categoriesQuery.isLoading ? (
          <LoadingView />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {(categoriesQuery.data ?? []).map((category) => (
              <CategoryChip
                key={category.id}
                label={category.name}
                onPress={() => router.push(`/category/${category.slug}`)}
              />
            ))}
          </ScrollView>
        )}

        {featured.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={18} color={colors.accent} />
              <Text style={styles.sectionTitle}>Featured</Text>
            </View>
            <View style={styles.grid}>
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular right now</Text>
        </View>
        {popularQuery.isLoading ? (
          <LoadingView />
        ) : popular.length === 0 ? (
          <EmptyState icon="storefront-outline" title="No products yet" message="Check back soon — the menu is being set up." />
        ) : (
          <View style={styles.grid}>
            {popular.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  brand: { ...typography.h1, color: colors.primary },
  tagline: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.text },
  chipRow: { marginBottom: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
});
