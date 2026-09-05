import { ScrollView, StyleSheet, Text, View } from "react-native";
import { DraftNotice } from "@/components/DraftNotice";
import { colors, spacing, typography } from "@/theme/theme";

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

/**
 * Draft only — see DraftNotice. Content below sticks to what's
 * verifiably true from this codebase (real order/cancellation states,
 * real payment methods actually offered) and marks everything that
 * needs a real business/legal decision as [TODO], rather than inventing
 * a registration number, grievance officer, or refund window that
 * doesn't exist anywhere in this repo.
 */
export default function TermsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DraftNotice />

      <Section title="Who this is">
        {"These terms govern orders placed through the Shri Anandam customer app for pickup or delivery from [TODO: legal business name and registration details]."}
      </Section>

      <Section title="Placing an order">
        {"An order is confirmed once payment is accepted (cash on delivery or pay at store) and you receive an order number. Prices, availability, and delivery/pickup times shown in the app are current at the time of ordering and are not guaranteed once your order is placed if stock changes."}
      </Section>

      <Section title="Cancelling an order">
        {"You can cancel an order from the order details screen at any point before it's marked Delivered, Rejected, or Cancelled — once the kitchen has started preparing or the order is out for delivery, cancelling it may not be possible to undo in practice even though the option is shown. [TODO: refund timeline and policy for already-prepared items.]"}
      </Section>

      <Section title="Payment">
        {"Orders are currently paid for by cash on delivery or in person at the store at pickup — no online payment is processed through the app today."}
      </Section>

      <Section title="Coupons and discounts">
        {"Coupon codes are subject to the conditions shown when applied (minimum order value, usage limits, first-order-only, or branch restrictions) and may be withdrawn or changed at any time."}
      </Section>

      <Section title="Your account">
        {"You're responsible for keeping the one-time codes sent to your mobile number confidential. [TODO: account termination / suspension policy.]"}
      </Section>

      <Section title="Contact">
        {"Questions about an order can be directed to the branch you ordered from — see Help & Support in your profile. [TODO: registered grievance officer name, email, and response-time commitment, if legally required in your jurisdiction.]"}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.background },
  section: { marginBottom: spacing.lg },
  heading: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
});
