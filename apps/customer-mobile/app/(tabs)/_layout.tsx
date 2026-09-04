import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "@/api/hooks/use-cart";
import { colors } from "@/theme/theme";

/**
 * React Navigation's `tabBarIcon` callback types `color` as RN's generic
 * ColorValue (string | number | NativeColorValue), because platform
 * color objects are technically possible — but `tabBarActiveTintColor`/
 * `tabBarInactiveTintColor` above are always the plain hex strings from
 * theme.ts, so it's safe to narrow to `string` explicitly rather than
 * threading that broader union through every icon.
 */
function TabIcon({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  return <Ionicons name={name} color={color} size={24} />;
}

export default function TabsLayout() {
  const { data: cart } = useCart();
  const itemCount = cart?.itemCount ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarIcon: ({ color }) => <TabIcon name="basket" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => <TabIcon name="receipt" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon name="person" color={color as string} />,
        }}
      />
    </Tabs>
  );
}
