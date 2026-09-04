import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/theme/theme";

export default function OnboardingScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.hero}>
        <View style={styles.iconWrapper}>
          <Ionicons name="restaurant" size={56} color={colors.primary} />
        </View>
        <Text style={styles.title}>Shri Anandam</Text>
        <Text style={styles.subtitle}>Sweets & Restaurant</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.heading}>Authentic sweets, delivered fresh</Text>
        <Text style={styles.description}>
          Order your favourite mithai, namkeen, and festival specials for home delivery or store pickup.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="Get Started" onPress={() => router.push("/(auth)/mobile-number")} testID="get-started-button" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "space-between", padding: spacing.lg },
  hero: { alignItems: "center", marginTop: spacing.xxl },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  body: { paddingHorizontal: spacing.md },
  heading: { ...typography.h2, color: colors.text, textAlign: "center", marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  footer: { paddingBottom: spacing.lg },
});
