import { Tabs } from "expo-router";
import { CustomTabBar } from "@/components/navigation/CustomTabBar";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="guild" />
      <Tabs.Screen name="dungeon" />
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
