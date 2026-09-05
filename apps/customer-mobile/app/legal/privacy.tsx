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
 * Draft only — see DraftNotice. "What we collect" below is limited to
 * fields that actually exist on the Customer/CustomerAddress/Order/
 * DeviceToken models in services/api/prisma/schema.prisma — not a
 * generic template's guess at what a food-ordering app might collect.
 */
export default function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DraftNotice />

      <Section title="What we collect">
        {"Your mobile number (used to log in via a one-time code), and optionally your name and email. If you save a delivery address, we store the contact name, phone number, and address you enter. We keep a record of your orders (items, prices, and status) and, if you allow notifications, a device token used to send you order updates."}
      </Section>

      <Section title="What we don't collect">
        {"We don't process or store payment card details — orders today are paid by cash on delivery or at the store, not through the app."}
      </Section>

      <Section title="How it's used">
        {"To let you place and track orders, to contact you about an order (including push notifications, if enabled), and to speed up future checkouts (saved addresses). We don't sell your data. [TODO: any marketing/analytics use, if that's added later, must be disclosed here before it happens.]"}
      </Section>

      <Section title="Who it's shared with">
        {"The branch fulfilling your order sees your order details and delivery address. [TODO: name any third-party processors actually in use — e.g. a push-notification provider, payment gateway, or SMS provider — once they're live in production; none of these are named here because this pass doesn't invent which ones you'll actually use.]"}
      </Section>

      <Section title="Your choices">
        {"You can edit or remove saved addresses and update your name/email from your profile at any time. Notification permissions can be turned off from your device's system settings. [TODO: account deletion process and data-retention period after deletion.]"}
      </Section>

      <Section title="Contact">
        {"Questions about your data can be directed to the branch you ordered from — see Help & Support in your profile. [TODO: registered grievance/data-protection contact, if legally required in your jurisdiction.]"}
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
