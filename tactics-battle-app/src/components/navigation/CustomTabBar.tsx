import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { House, Settings, Swords, Users } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import { parchment, parchmentShadow } from "@/theme/parchment";

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          const label =
            route.name === "guild"
              ? t("tab.guild")
              : route.name === "dungeon"
                ? t("tab.dungeon")
                : route.name === "shop"
                  ? t("tab.home")
                  : t("tab.more");

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={options.tabBarAccessibilityLabel}
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.item}
            >
              {route.name === "guild" ? <Users size={18} stroke={isFocused ? parchment.ink : parchment.inkMuted} /> : null}
              {route.name === "dungeon" ? <Swords size={18} stroke={isFocused ? parchment.ink : parchment.inkMuted} /> : null}
              {route.name === "shop" ? <House size={18} stroke={isFocused ? parchment.ink : parchment.inkMuted} /> : null}
              {route.name === "more" ? <Settings size={18} stroke={isFocused ? parchment.ink : parchment.inkMuted} /> : null}
              <Text style={isFocused ? styles.labelActive : styles.label}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: parchment.background,
  },
  bar: {
    ...parchmentShadow,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    height: 64,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: parchment.borderStrong,
    backgroundColor: parchment.surface,
    padding: 4,
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  labelActive: {
    color: parchment.ink,
    fontSize: 10,
    fontWeight: "700",
  },
  label: {
    color: parchment.inkMuted,
    fontSize: 10,
    fontWeight: "500",
  },
});
