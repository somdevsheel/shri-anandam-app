import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/theme";

function TabIcon({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  return <Ionicons name={name} color={color} size={24} />;
}

export default function TabsLayout() {
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
        name="orders"
        options={{ title: "Orders", tabBarIcon: ({ color }) => <TabIcon name="fast-food" color={color as string} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "History", tabBarIcon: ({ color }) => <TabIcon name="time" color={color as string} /> }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ title: "Alerts", tabBarIcon: ({ color }) => <TabIcon name="notifications" color={color as string} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color }) => <TabIcon name="person" color={color as string} /> }}
      />
    </Tabs>
  );
}
