import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/theme/theme";

/**
 * Placeholder — checkout (fulfillment choice, payment, order creation)
 * is Phase 6 of the build (docs/architecture/order-lifecycle.md,
 * payment-architecture.md), not yet implemented. This screen exists so
 * "Proceed to Checkout" is an honest dead end instead of a 404, and
 * becomes the real checkout flow's home once that phase lands.
 */
export default function CheckoutPlaceholderScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Ionicons name="construct-outline" size={48} color={colors.textMuted} />
        <Text style={styles.title}>Checkout is on its way</Text>
        <Text style={styles.message}>
          Order placement, delivery/pickup, and payment are coming in the next update. Your cart is saved.
        </Text>
        <Button label="Back to Cart" onPress={() => router.back()} variant="outline" style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  title: { ...typography.h3, color: colors.text, textAlign: "center", marginTop: spacing.sm },
  message: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  button: { marginTop: spacing.md, minWidth: 180 },
});
