import { Image, ImageSourcePropType, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { parchment, parchmentShadow } from "@/theme/parchment";

export type PartyStatusStripMember = {
  id: string;
  name: string;
  classId?: string;
  hp: number;
  mp: number;
  level?: number | null;
};

type FaceCrop = { size: number; offsetY: number };

type Props = {
  members: PartyStatusStripMember[];
  containerStyle?: StyleProp<ViewStyle>;
};

const CLASS_IMAGE: Record<string, ImageSourcePropType> = {
  GUARDIAN: require("@/assets/images/class/gurdian.png"),
  SWORDMAN: require("@/assets/images/class/swordman.png"),
  BERSERKER: require("@/assets/images/class/berserker.png"),
  CLERIC: require("@/assets/images/class/cleric.png"),
  WITCH: require("@/assets/images/class/witch.png"),
  THIEF: require("@/assets/images/class/thief.png"),
  PORTER: require("@/assets/images/class/thief.png"),
};

// Class-specific face crop positions. Tweak offsetY per class to align faces in the circle.
const PARTY_PORTRAIT_FACE_CROP_BY_CLASS: Record<string, FaceCrop> = {
  GUARDIAN: { size: 54, offsetY: -11 },
  SWORDMAN: { size: 54, offsetY: -11 },
  BERSERKER: { size: 54, offsetY: -11 },
  CLERIC: { size: 54, offsetY: -11 },
  WITCH: { size: 54, offsetY: -11 },
  THIEF: { size: 54, offsetY: -11 },
  PORTER: { size: 54, offsetY: -11 },
};

const DEFAULT_FACE_CROP: FaceCrop = { size: 54, offsetY: -11 };

const getClassImage = (classId?: string): ImageSourcePropType =>
  (classId && CLASS_IMAGE[classId]) || CLASS_IMAGE.SWORDMAN;

const getPartyPortraitFaceCrop = (classId?: string): FaceCrop =>
  (classId && PARTY_PORTRAIT_FACE_CROP_BY_CLASS[classId]) || DEFAULT_FACE_CROP;

export const PartyStatusStrip = ({ members, containerStyle }: Props) => (
  <View style={[styles.partySection, containerStyle]}>
    {members.slice(0, 6).map((member) => {
      const portraitCrop = getPartyPortraitFaceCrop(member.classId);
      return (
        <View key={member.id} style={styles.partyColumn}>
          <View style={styles.partyHeader}>
            <View style={styles.partyPortraitClip}>
              <Image
                source={getClassImage(member.classId)}
                style={[
                  styles.partyPortrait,
                  { width: portraitCrop.size, height: portraitCrop.size, marginTop: portraitCrop.offsetY },
                ]}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.partyName} numberOfLines={1}>
              {member.name}
            </Text>
          </View>
          <View style={styles.partyStatRow}>
            <Text style={[styles.partyStatLabel, styles.partyHpLine]} numberOfLines={1}>
              H
            </Text>
            <Text style={[styles.partyStatValue, styles.partyHpLine]} numberOfLines={1}>
              {member.hp}
            </Text>
          </View>
          <View style={styles.partyStatRow}>
            <Text style={[styles.partyStatLabel, styles.partyMpLine]} numberOfLines={1}>
              M
            </Text>
            <Text style={[styles.partyStatValue, styles.partyMpLine]} numberOfLines={1}>
              {member.mp}
            </Text>
          </View>
          <View style={styles.partyStatRow}>
            <Text style={[styles.partyStatLabel, styles.partyLvLine]} numberOfLines={1}>
              Lv
            </Text>
            <Text style={[styles.partyStatValue, styles.partyLvLine]} numberOfLines={1}>
              {member.level ?? "--"}
            </Text>
          </View>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  partySection: {
    ...parchmentShadow,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: parchment.goldLine,
    backgroundColor: parchment.surface,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  partyColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 2,
  },
  partyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    width: "100%",
  },
  partyPortraitClip: {
    width: 28,
    height: 28,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: parchment.surfaceStrong,
    alignItems: "center",
    justifyContent: "flex-start",
    borderWidth: 1,
    borderColor: parchment.goldLine,
  },
  partyPortrait: {
    width: 54,
    height: 54,
    marginTop: -11,
  },
  partyName: {
    maxWidth: "100%",
    color: parchment.ink,
    fontSize: 10,
    fontWeight: "600",
  },
  partyStatRow: {
    width: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  partyStatLabel: {
    fontSize: 11,
    fontWeight: "500",
    minWidth: 16,
    textAlign: "left",
  },
  partyStatValue: {
    fontSize: 11,
    fontWeight: "500",
    width: 24,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  partyHpLine: {
    color: parchment.ink,
  },
  partyMpLine: {
    color: parchment.inkSoft,
  },
  partyLvLine: {
    color: parchment.inkMuted,
  },
});
