import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import PlusButton from "../../../components/PlusButton";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#007bff",
        tabBarShowLabel: true,
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="index" // This points to app/(tabs)/index.jsx
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      {/* Sheets Tab */}
      <Tabs.Screen
        name="sheets/list" // <-- Notice it's now "sheets/list"
        options={{
          title: "",
          tabBarIcon: ({ focused }) => <PlusButton focused={focused} />,
          headerShown: false,
          tabBarLabel: () => null, // Hides the label for FAB look
        }}
      />
    </Tabs>
  );
}
