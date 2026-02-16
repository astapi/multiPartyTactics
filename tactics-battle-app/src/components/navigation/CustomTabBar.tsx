import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Home, Settings, Swords, Users } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";

const colors = {
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textMuted: "#aaaaaa",
  borderDefault: "#e0e0e0",
} as const;

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
            route.name === "index"
              ? t("home.tab.home")
              : route.name === "dungeon"
                ? t("home.tab.dungeon")
                : route.name === "guild"
                  ? t("home.tab.guild")
                  : t("home.tab.more");

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
              {route.name === "index" ? <Home size={18} stroke={isFocused ? colors.textPrimary : colors.textMuted} /> : null}
              {route.name === "dungeon" ? <Swords size={18} stroke={isFocused ? colors.textPrimary : colors.textMuted} /> : null}
              {route.name === "guild" ? <Users size={18} stroke={isFocused ? colors.textPrimary : colors.textMuted} /> : null}
              {route.name === "settings" ? <Settings size={18} stroke={isFocused ? colors.textPrimary : colors.textMuted} /> : null}
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
    backgroundColor: "#ffffff",
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    height: 64,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
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
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: "600",
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "500",
  },
});
