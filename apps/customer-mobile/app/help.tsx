import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBranches } from "@/api/hooks/use-catalog";
import { Button } from "@/components/ui/Button";
import { LoadingView } from "@/components/ui/LoadingView";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors, radius, spacing, typography } from "@/theme/theme";

/** Real branch phone numbers (GET /catalog/branches), not a fake ticketing system this app has no backend for. */
export default function HelpScreen() {
  const { data: branches, isLoading } = useBranches();

  if (isLoading) return <LoadingView />;

  const withPhone = (branches ?? []).filter((b) => b.phone);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Need help with an order or have a question? Call the branch directly.</Text>

      {withPhone.length === 0 ? (
        <EmptyState icon="call-outline" title="No contact number on file yet" message="Check back soon." />
      ) : (
        withPhone.map((branch) => (
          <View key={branch.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="storefront-outline" size={18} color={colors.primary} />
              <Text style={styles.branchName}>{branch.name}</Text>
            </View>
            <Text style={styles.address}>{branch.address}</Text>
            <Button
              label={`Call ${branch.phone}`}
              onPress={() => Linking.openURL(`tel:${branch.phone}`)}
              style={styles.callButton}
            />
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, backgroundColor: colors.background, flexGrow: 1 },
  intro: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  branchName: { ...typography.bodyBold, color: colors.text },
  address: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  callButton: {},
});
