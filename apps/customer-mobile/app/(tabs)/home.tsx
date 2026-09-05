import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CategoryTile } from "@/components/CategoryTile";
import { ProductCard } from "@/components/ProductCard";
import { LoadingView } from "@/components/ui/LoadingView";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCategories, useProducts } from "@/api/hooks/use-catalog";
import { useProfile } from "@/api/hooks/use-customer";
import { colors, fonts, radius, spacing, typography } from "@/theme/theme";

function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function HomeScreen() {
  const [searchText, setSearchText] = useState("");
  const categoriesQuery = useCategories();
  const featuredQuery = useProducts({ isFeatured: true });
  const popularQuery = useProducts({});
  const { data: profile } = useProfile();
  const insets = useSafeAreaInsets();

  const submitSearch = () => {
    if (searchText.trim().length === 0) return;
    router.push({ pathname: "/(tabs)/search", params: { q: searchText.trim() } });
  };

  const featured = featuredQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const popular = popularQuery.data?.pages.flatMap((p) => p.items).slice(0, 6) ?? [];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.headerRow}>
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>Shri Anandam</Text>
            <Text style={styles.tagline}>Sweets & Restaurant</Text>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            accessibilityRole="button"
            accessibilityLabel="Profile"
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initialsOf(profile?.name)}</Text>
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sweets, food, namkeen…"
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            testID="home-search-input"
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable
          style={styles.hero}
          onPress={() => router.push("/category/all")}
          accessibilityRole="button"
          accessibilityLabel="Browse the menu"
        >
          <View style={styles.heroArt} />
          <View style={styles.heroBody}>
            <Text style={styles.heroEyebrow}>Fresh from our kitchen</Text>
            <Text style={styles.heroTitle}>Sweets, snacks and full meals — made daily</Text>
            <Text style={styles.heroSubtitle}>Order for pickup or delivery from your nearest branch.</Text>
            <View style={styles.heroCta}>
              <Text style={styles.heroCtaText}>Browse the menu</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shop by category</Text>
        </View>
        {categoriesQuery.isLoading ? (
          <LoadingView />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {(categoriesQuery.data ?? []).map((category) => (
              <CategoryTile key={category.id} category={category} onPress={() => router.push(`/category/${category.slug}`)} />
            ))}
          </ScrollView>
        )}

        {featured.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
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
          <Text style={styles.sectionTitle}>Popular today</Text>
          <Pressable onPress={() => router.push("/category/all")} accessibilityRole="button">
            <Text style={styles.sectionLink}>View all</Text>
          </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.maroon, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.xs },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandBlock: { flex: 1, minWidth: 0 },
  brand: { ...typography.display, fontSize: 24, color: colors.background },
  tagline: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.accentOnMaroon, marginTop: 2 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(232,199,122,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 14, fontWeight: "700", color: colors.accentOnMaroon },
  searchBar: {
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 14, color: colors.text, height: "100%" },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroArt: { height: 110, backgroundColor: "#F1DDBE" },
  heroBody: { padding: spacing.md },
  heroEyebrow: { fontFamily: fonts.sansBold, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, color: colors.primary, textTransform: "uppercase" },
  heroTitle: { ...typography.display, fontSize: 19, color: colors.text, marginTop: spacing.xs },
  heroSubtitle: { fontFamily: fonts.sansRegular, fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 19 },
  heroCta: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCtaText: { fontFamily: fonts.sansBold, fontSize: 13, fontWeight: "700", color: colors.onPrimary },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.h3, color: colors.text },
  sectionLink: { fontFamily: fonts.sansBold, fontSize: 12, fontWeight: "700", color: colors.primary },
  categoryRow: { paddingBottom: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
});
