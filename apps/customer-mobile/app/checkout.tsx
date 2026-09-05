import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PaymentMethod, formatInr } from "@shri-anandam/shared-types";
import { createOrderSchema } from "@shri-anandam/validation";
import { useCart } from "@/api/hooks/use-cart";
import { useAddresses } from "@/api/hooks/use-customer";
import { useCreateOrder } from "@/api/hooks/use-orders";
import { useApplyCoupon } from "@/api/hooks/use-coupons";
import { ApiError } from "@/api/client";
import { AddressCard } from "@/components/AddressCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import { colors, fonts, radius, spacing, typography } from "@/theme/theme";

type FulfillmentType = "DELIVERY" | "PICKUP";

/**
 * The real checkout flow — this screen was a placeholder through Phase
 * 5 ("Checkout is on its way", see git history) with the actual
 * POST /orders wiring never having been built despite services/api's
 * orders module (Phase 6) being complete and tested. Built as a
 * prerequisite for Phase 11's "live status updates for customer" to
 * have anything real to attach to.
 *
 * Payment methods offered here are COD and Pay at Store only —
 * services/api also supports UPI/CARD/NET_BANKING via Razorpay (Phase
 * 7), but that requires a native checkout SDK/WebView this app has
 * never integrated; offering those options here would be dishonest
 * about what actually works end to end today.
 */
export default function CheckoutScreen() {
  const { data: cartData, isLoading: cartLoading } = useCart();
  const { data: addresses, isLoading: addressesLoading } = useAddresses();
  const createOrder = useCreateOrder();
  const applyCoupon = useApplyCoupon();

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("PICKUP");
  const [addressId, setAddressId] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.COD);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountInPaise: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Generated once per mount, reused across retries of the SAME attempt
  // (section 11) — a network-timeout retry with this key hits the
  // server's idempotent replay path instead of creating a second order.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (cartLoading || addressesLoading) return <LoadingView />;

  const cart = cartData?.cart;
  if (!cart || cart.items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <EmptyState icon="basket-outline" title="Your cart is empty" message="Add something before checking out." />
      </SafeAreaView>
    );
  }

  const selectedAddress = addresses?.find((a) => a.id === addressId) ?? addresses?.find((a) => a.isDefault) ?? addresses?.[0];
  const effectiveAddressId = fulfillmentType === "DELIVERY" ? (addressId ?? selectedAddress?.id) : undefined;

  const handleApplyCoupon = () => {
    if (!couponInput.trim()) return;
    setCouponMessage(null);
    applyCoupon.mutate(couponInput.trim(), {
      onSuccess: (result) => {
        if (result.valid) {
          setAppliedCoupon({ code: result.coupon.code, discountInPaise: result.discountInPaise });
          setCouponMessage(null);
        } else {
          setAppliedCoupon(null);
          setCouponMessage(result.message);
        }
      },
      onError: (err) => setCouponMessage(err instanceof ApiError ? err.message : "Couldn't check that code. Try again."),
    });
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponMessage(null);
    setCouponInput("");
  };

  const handlePlaceOrder = () => {
    const result = createOrderSchema.safeParse({
      fulfillmentType,
      addressId: effectiveAddressId,
      paymentMethod,
      couponCode: appliedCoupon?.code,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check your order details");
      return;
    }
    setError(null);
    createOrder.mutate(
      { dto: result.data, idempotencyKey },
      {
        onSuccess: (order) => router.replace(`/order-success/${order.id}`),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not place your order. Please try again."),
      },
    );
  };

  const deliveryBlocked = fulfillmentType === "DELIVERY" && !effectiveAddressId;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Fulfillment</Text>
        <View style={styles.optionRow}>
          <SelectCard label="Pickup" note="Collect from the branch" icon="storefront-outline" selected={fulfillmentType === "PICKUP"} onPress={() => setFulfillmentType("PICKUP")} />
          <SelectCard label="Delivery" note="Sent to your address" icon="bicycle-outline" selected={fulfillmentType === "DELIVERY"} onPress={() => setFulfillmentType("DELIVERY")} />
        </View>

        {fulfillmentType === "PICKUP" ? (
          <View style={styles.infoCard}>
            <Ionicons name="location-outline" size={18} color={colors.textMuted} />
            <Text style={styles.infoCardText}>Pickup from {cart.branch.name}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Delivery address</Text>
            {!addresses || addresses.length === 0 ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoCardText}>You don't have any saved addresses yet.</Text>
              </View>
            ) : (
              addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  address={address}
                  selected={address.id === effectiveAddressId}
                  onPress={() => setAddressId(address.id)}
                />
              ))
            )}
            <Button label="Add new address" variant="outline" onPress={() => router.push("/addresses/new")} />
          </>
        )}

        <Text style={styles.sectionTitle}>Payment method</Text>
        <View style={styles.optionRow}>
          <SelectCard label="Cash on delivery" note="Pay the rider in cash" icon="cash-outline" selected={paymentMethod === PaymentMethod.COD} onPress={() => setPaymentMethod(PaymentMethod.COD)} />
          <SelectCard label="Pay at store" note="Settle at the counter" icon="storefront-outline" selected={paymentMethod === PaymentMethod.PAY_AT_STORE} onPress={() => setPaymentMethod(PaymentMethod.PAY_AT_STORE)} />
        </View>

        <Text style={styles.sectionTitle}>Coupon</Text>
        {appliedCoupon ? (
          <View style={styles.couponApplied}>
            <View style={{ flex: 1 }}>
              <Text style={styles.couponAppliedCode}>{appliedCoupon.code}</Text>
              <Text style={styles.couponAppliedNote}>You're saving {formatInr(appliedCoupon.discountInPaise)}</Text>
            </View>
            <Pressable onPress={handleRemoveCoupon} accessibilityRole="button">
              <Text style={styles.couponRemove}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.couponRow}>
            <TextInput
              style={styles.couponInput}
              placeholder="Enter code"
              autoCapitalize="characters"
              placeholderTextColor={colors.textMuted}
              value={couponInput}
              onChangeText={setCouponInput}
              testID="coupon-input"
            />
            <Button
              label="Apply"
              variant="outline"
              onPress={handleApplyCoupon}
              loading={applyCoupon.isPending}
              disabled={!couponInput.trim()}
              style={styles.couponApplyButton}
              testID="apply-coupon-button"
            />
          </View>
        )}
        {couponMessage ? <Text style={styles.couponMessage}>{couponMessage}</Text> : null}

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatInr(cartData?.subtotalInPaise ?? 0)}</Text>
          </View>
          {appliedCoupon ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount · {appliedCoupon.code}</Text>
              <Text style={styles.discountValue}>−{formatInr(appliedCoupon.discountInPaise)}</Text>
            </View>
          ) : null}
          <Text style={styles.summaryNote}>Final total (with delivery fee/tax) is confirmed on the order confirmation screen.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Place order"
          onPress={handlePlaceOrder}
          loading={createOrder.isPending}
          disabled={deliveryBlocked}
          testID="place-order-button"
        />
      </View>
    </SafeAreaView>
  );
}

function SelectCard({
  label,
  note,
  icon,
  selected,
  onPress,
}: {
  label: string;
  note: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.selectCard, selected && styles.selectCardSelected]}
    >
      <Ionicons name={icon} size={18} color={selected ? colors.primary : colors.textMuted} />
      <Text style={[styles.selectCardLabel, selected && styles.selectCardLabelSelected]}>{label}</Text>
      <Text style={styles.selectCardNote}>{note}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  optionRow: { flexDirection: "row", gap: spacing.sm },
  selectCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 4,
  },
  selectCardSelected: { borderColor: colors.primary, backgroundColor: colors.warningBackground },
  selectCardLabel: { ...typography.bodyBold, color: colors.text },
  selectCardLabelSelected: { color: colors.text },
  selectCardNote: { ...typography.caption, color: colors.textMuted },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  infoCardText: { ...typography.body, color: colors.textMuted, flex: 1 },
  couponRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  couponInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    letterSpacing: 0.5,
    color: colors.text,
  },
  couponApplyButton: { minWidth: 90 },
  couponMessage: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  couponApplied: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.success,
    backgroundColor: "#E4F0E5",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  couponAppliedCode: { fontFamily: fonts.sansBold, fontSize: 14, fontWeight: "700", color: colors.text, letterSpacing: 0.5 },
  couponAppliedNote: { ...typography.caption, color: colors.success, marginTop: 2 },
  couponRemove: { fontFamily: fonts.sansBold, fontSize: 12, fontWeight: "700", color: colors.textMuted },
  discountValue: { ...typography.h3, color: colors.success },
  summaryCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  summaryLabel: { ...typography.body, color: colors.textMuted },
  summaryValue: { ...typography.h3, color: colors.text },
  summaryNote: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.body, color: colors.danger, marginTop: spacing.sm },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
