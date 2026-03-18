import { ImageSourcePropType, ViewStyle } from "react-native";

export const parchment = {
  background: "#e9dcc3",
  surface: "#f4ecdd",
  surfaceStrong: "#efe3cf",
  surfaceMuted: "rgba(245, 237, 224, 0.45)",
  ink: "#3b2e1e",
  inkSoft: "#7a6b55",
  inkMuted: "#a0937f",
  gold: "#c4a870",
  goldSoft: "rgba(196, 168, 112, 0.28)",
  goldLine: "rgba(196, 168, 112, 0.4)",
  border: "#c4b8a0",
  borderStrong: "#a89878",
  overlay: "rgba(26, 14, 5, 0.7)",
  headerBar: "#3b2e1e",
  success: "#5c7b55",
  danger: "#7a4336",
} as const;

export const parchmentImages: Record<string, ImageSourcePropType> = {
  tavernHeader: require("@/assets/images/headers/tavern-header.png"),
  guildHeader: require("@/assets/images/headers/guild-header.png"),
  townHeader: require("@/assets/images/headers/town-header.png"),
  equipmentShopHeader: require("@/assets/images/headers/equipment-shop-header.png"),
  itemShopHeader: require("@/assets/images/headers/item-shop-header.png"),
  dungeonEncounter: require("@/assets/images/headers/dungeon-encounter.jpg"),
  parchmentLog: require("@/assets/images/headers/parchment-log.png"),
  parchmentModal: require("@/assets/images/headers/parchment-modal.png"),
} as const;

export const parchmentShadow: ViewStyle = {
  shadowColor: "#2b1c0f",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.12,
  shadowRadius: 18,
  elevation: 4,
};
