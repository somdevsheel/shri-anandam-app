import { Alert, FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { AddressCard } from "@/components/AddressCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingView } from "@/components/ui/LoadingView";
import { Button } from "@/components/ui/Button";
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from "@/api/hooks/use-customer";
import { colors, spacing } from "@/theme/theme";

export default function AddressListScreen() {
  const { data: addresses, isLoading } = useAddresses();
  const setDefault = useSetDefaultAddress();
  const deleteAddress = useDeleteAddress();

  if (isLoading) return <LoadingView />;

  const confirmDelete = (id: string) => {
    Alert.alert("Remove address", "Are you sure you want to remove this address?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteAddress.mutate(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={addresses ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState icon="location-outline" title="No saved addresses" message="Add one to speed up checkout." />
        }
        renderItem={({ item }) => (
          <AddressCard
            address={item}
            onSetDefault={() => setDefault.mutate(item.id)}
            onDelete={() => confirmDelete(item.id)}
          />
        )}
      />
      <View style={styles.footer}>
        <Button label="Add new address" onPress={() => router.push("/addresses/new")} testID="add-address-button" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
