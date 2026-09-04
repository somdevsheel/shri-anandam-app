import { useState, type ReactNode } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { OrderStatus } from "@shri-anandam/shared-types";
import { useAddOrderNote, useOrder, useUpdateOrderStatus } from "@/api/hooks/use-orders";
import { useAuthStore } from "@/lib/auth-store";
import { getAvailableActions } from "@/lib/order-actions";
import { formatDateTime, formatInr } from "@/lib/format";
import { ApiError } from "@/api/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { LoadingView } from "@/components/ui/LoadingView";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors, radius, spacing, typography } from "@/theme/theme";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, error } = useOrder(id);
  const updateStatus = useUpdateOrderStatus(id ?? "");
  const addNote = useAddOrderNote(id ?? "");
  const permissions = useAuthStore((s) => s.staff?.permissions ?? []);

  const [pendingAction, setPendingAction] = useState<{ status: OrderStatus; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [noteText, setNoteText] = useState("");

  if (isLoading) return <LoadingView />;
  if (error || !order) return <EmptyState icon="alert-circle-outline" title="Couldn't load this order" />;

  const actions = getAvailableActions(order.status as OrderStatus, order.fulfillmentType, permissions);
  const needsReason = pendingAction?.label.includes("Reject") || pendingAction?.label.includes("Cancel");

  const runAction = (status: OrderStatus, providedReason?: string) => {
    updateStatus.mutate(
      { status, reason: providedReason || undefined },
      {
        onSuccess: () => setPendingAction(null),
        onError: (err) => {
          Alert.alert("Couldn't update order", err instanceof ApiError ? err.message : "Please try again.");
        },
      },
    );
  };

  const handleActionPress = (action: { status: OrderStatus; label: string }) => {
    // Reject/Cancel take a reason (section 19) — a short inline prompt
    // rather than a native Alert.prompt, which iOS supports but Android
    // does not.
    if (action.label.includes("Reject") || action.label.includes("Cancel")) {
      setPendingAction(action);
      setReason("");
      return;
    }
    Alert.alert(action.label, `Confirm: ${action.label.toLowerCase()} order #${order.orderNumber}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => runAction(action.status) },
    ]);
  };

  const callCustomer = () => {
    if (!order.customer?.mobileNumber) return;
    void Linking.openURL(`tel:${order.customer.mobileNumber}`);
  };

  const submitNote = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    addNote.mutate({ note: trimmed }, { onSuccess: () => setNoteText("") });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <StatusBadge status={order.status} />
      </View>
      <Text style={styles.placedAt}>Placed {formatDateTime(order.placedAt)}</Text>

      <Section title="Customer">
        <View style={styles.customerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bodyBold}>{order.customer?.name ?? "Customer"}</Text>
            <Text style={styles.bodyMuted}>{order.customer?.mobileNumber ?? "No phone on file"}</Text>
          </View>
          {order.customer?.mobileNumber ? (
            <Button label="Call" onPress={callCustomer} variant="outline" style={styles.callButton} testID="call-customer-button" />
          ) : null}
        </View>
        {order.fulfillmentType === "DELIVERY" && order.addressSnapshot ? (
          <Text style={styles.address}>
            {order.addressSnapshot.line1}
            {order.addressSnapshot.line2 ? `, ${order.addressSnapshot.line2}` : ""}, {order.addressSnapshot.city},{" "}
            {order.addressSnapshot.state} {order.addressSnapshot.pincode}
          </Text>
        ) : (
          <Text style={styles.address}>{order.fulfillmentType === "PICKUP" ? "Pickup at " + order.branch.name : ""}</Text>
        )}
      </Section>

      <Section title="Items">
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyBold}>
                {item.quantity}× {item.productNameSnapshot}
              </Text>
              <Text style={styles.bodyMuted}>{item.variantNameSnapshot}</Text>
              {item.addons.map((addon) => (
                <Text key={addon.id} style={styles.addonText}>
                  + {addon.addonNameSnapshot}
                </Text>
              ))}
              {item.specialInstructions ? <Text style={styles.instructions}>"{item.specialInstructions}"</Text> : null}
            </View>
            <Text style={styles.bodyBold}>{formatInr(item.finalPriceInPaise)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <TotalsRow label="Subtotal" value={order.subtotalInPaise} />
        {order.discountInPaise > 0 ? <TotalsRow label="Discount" value={-order.discountInPaise} /> : null}
        {order.deliveryFeeInPaise > 0 ? <TotalsRow label="Delivery Fee" value={order.deliveryFeeInPaise} /> : null}
        {order.taxInPaise > 0 ? <TotalsRow label="Tax" value={order.taxInPaise} /> : null}
        <TotalsRow label="Total" value={order.totalInPaise} bold />
      </Section>

      <Section title="Payment">
        {order.payments.map((payment) => (
          <View key={payment.id} style={styles.paymentRow}>
            <Text style={styles.bodyBold}>
              {payment.method} · {payment.status}
            </Text>
            <Text style={styles.bodyMuted}>{formatInr(payment.amountInPaise)}</Text>
          </View>
        ))}
      </Section>

      <Section title="Status History">
        {order.statusHistory.map((entry) => (
          <View key={entry.id} style={styles.historyRow}>
            <Ionicons name="ellipse" size={8} color={colors.primary} style={styles.historyDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyBold}>{entry.newStatus}</Text>
              <Text style={styles.bodyMuted}>
                {formatDateTime(entry.createdAt)} · by {entry.actorType.toLowerCase()}
              </Text>
              {entry.reason ? <Text style={styles.instructions}>{entry.reason}</Text> : null}
            </View>
          </View>
        ))}
      </Section>

      <Section title="Notes">
        {order.notes.map((note) => (
          <View key={note.id} style={styles.noteRow}>
            <Text style={styles.body}>{note.note}</Text>
            <Text style={styles.bodyMuted}>{formatDateTime(note.createdAt)}</Text>
          </View>
        ))}
        <View style={styles.noteInputRow}>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Add a note…" value={noteText} onChangeText={setNoteText} testID="order-note-input" />
          </View>
          <Button label="Add" onPress={submitNote} loading={addNote.isPending} disabled={!noteText.trim()} style={styles.noteButton} />
        </View>
      </Section>

      {pendingAction && needsReason ? (
        <Section title={`${pendingAction.label} — reason (optional)`}>
          <TextField placeholder="Why?" value={reason} onChangeText={setReason} testID="reason-input" />
          <View style={styles.reasonActions}>
            <Button label="Back" variant="outline" onPress={() => setPendingAction(null)} style={styles.reasonBackButton} />
            <Button
              label={`Confirm ${pendingAction.label}`}
              variant="danger"
              onPress={() => runAction(pendingAction.status, reason.trim())}
              loading={updateStatus.isPending}
              style={styles.reasonConfirmButton}
            />
          </View>
        </Section>
      ) : (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Button
              key={action.status}
              label={action.label}
              variant={action.variant}
              onPress={() => handleActionPress(action)}
              loading={updateStatus.isPending}
              style={styles.actionButton}
              testID={`action-${action.status}`}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TotalsRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.totalsRow}>
      <Text style={bold ? styles.bodyBold : styles.bodyMuted}>{label}</Text>
      <Text style={bold ? styles.bodyBold : styles.bodyMuted}>{formatInr(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderNumber: { ...typography.h2, color: colors.text },
  placedAt: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.sm },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { ...typography.caption, color: colors.textMuted, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.5 },
  body: { ...typography.body, color: colors.text },
  bodyBold: { ...typography.bodyBold, color: colors.text },
  bodyMuted: { ...typography.body, color: colors.textMuted },
  addonText: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm },
  instructions: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", marginTop: 2 },
  customerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  callButton: { paddingHorizontal: spacing.md, minHeight: 40 },
  address: { ...typography.caption, color: colors.textMuted },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  totalsRow: { flexDirection: "row", justifyContent: "space-between" },
  paymentRow: { flexDirection: "row", justifyContent: "space-between" },
  historyRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  historyDot: { marginTop: 6 },
  noteRow: { paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  noteInputRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  noteButton: { minHeight: 48 },
  actions: { gap: spacing.sm },
  actionButton: {},
  reasonActions: { flexDirection: "row", gap: spacing.sm },
  reasonBackButton: { flex: 1 },
  reasonConfirmButton: { flex: 2 },
});
