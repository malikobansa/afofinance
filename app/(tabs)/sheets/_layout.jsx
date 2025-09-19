import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import PlusButton from "../../../components/PlusButton"; // Correct relative path

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#007bff", // Your brand color
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sheets"
        options={{
          title: "",
          tabBarIcon: () => <PlusButton />, // Your custom Plus button
          headerShown: false,
        }}
      />
    </Tabs>
  );
}