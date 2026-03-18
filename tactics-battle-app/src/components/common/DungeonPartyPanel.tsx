import { Image, ImageSourcePropType, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { parchment } from "@/theme/parchment";

export type DungeonPartyPanelMember = {
  id: string;
  name: string;
  classId?: string;
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
  level?: number | null;
};

type Props = {
  members: DungeonPartyPanelMember[];
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

const getClassImage = (classId?: string): ImageSourcePropType =>
  (classId && CLASS_IMAGE[classId]) || CLASS_IMAGE.SWORDMAN;

export const DungeonPartyPanel = ({ members, containerStyle }: Props) => {
  const rows: DungeonPartyPanelMember[][] = [];
  for (let index = 0; index < members.length; index += 3) {
    rows.push(members.slice(index, index + 3));
  }

  return (
    <View style={[styles.partyStrip, containerStyle]}>
      {rows.map((row, rowIndex) => (
        <View key={`party-row-${rowIndex}`} style={[styles.partyRow, rowIndex > 0 ? styles.partyRowSpaced : null]}>
          {row.map((member) => {
            const hpRatio = member.maxHp > 0 ? Math.max(0, Math.min(1, member.hp / member.maxHp)) : 0;
            const mpRatio = member.maxMp > 0 ? Math.max(0, Math.min(1, member.mp / member.maxMp)) : 0;
            return (
              <View key={member.id} style={styles.partyCard}>
                <View style={styles.partyCardHeader}>
                  <View style={styles.partyPortraitFrame}>
                    <View style={styles.partyPortraitClip}>
                      <Image source={getClassImage(member.classId)} style={styles.partyPortrait} resizeMode="contain" />
                    </View>
                  </View>
                  <Text style={styles.partyName} numberOfLines={1}>
                    {member.name}
                  </Text>
                </View>
                <Text style={styles.partyLevelText}>{`Lv ${member.level ?? "--"}`}</Text>
                <View style={styles.partyMetricRow}>
                  <Text style={styles.partyMetricLabel}>HP</Text>
                  <View style={styles.partyMetricBarWrap}>
                    <View style={styles.partyMetricBarTrack}>
                      <View style={[styles.partyMetricBarFillHp, { width: `${hpRatio * 100}%` }]} />
                    </View>
                    <Text style={styles.partyMetricValue}>{member.hp}</Text>
                  </View>
                </View>
                <View style={styles.partyMetricRow}>
                  <Text style={styles.partyMetricLabel}>MP</Text>
                  <View style={styles.partyMetricBarWrap}>
                    <View style={styles.partyMetricBarTrack}>
                      <View style={[styles.partyMetricBarFillMp, { width: `${mpRatio * 100}%` }]} />
                    </View>
                    <Text style={styles.partyMetricValue}>{member.mp}</Text>
                  </View>
                </View>
                <View style={styles.partyCardUnderline} />
              </View>
            );
          })}
          {row.length < 3
            ? Array.from({ length: 3 - row.length }).map((_, fillerIndex) => (
                <View key={`party-filler-${rowIndex}-${fillerIndex}`} style={styles.partyCard} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  partyStrip: {
    marginTop: 0,
    borderRadius: 0,
    backgroundColor: "rgba(244,236,221,0.28)",
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 14,
    marginBottom: 10,
  },
  partyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  partyRowSpaced: {
    marginTop: 18,
  },
  partyCard: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 8,
  },
  partyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  partyPortraitFrame: {
    width: 36,
    height: 36,
    overflow: "hidden",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  partyPortraitClip: {
    width: 36,
    height: 36,
    overflow: "hidden",
    position: "relative",
  },
  partyPortrait: {
    width: 98,
    height: 140,
    position: "absolute",
    left: -35,
    top: -28,
  },
  partyName: {
    flex: 1,
    color: parchment.ink,
    fontSize: 11,
    fontWeight: "700",
  },
  partyLevelText: {
    marginTop: 8,
    color: parchment.inkMuted,
    fontSize: 9,
    fontWeight: "500",
  },
  partyMetricRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  partyMetricLabel: {
    width: 18,
    color: parchment.ink,
    fontSize: 9,
    fontWeight: "500",
  },
  partyMetricBarWrap: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
  },
  partyMetricBarTrack: {
    width: "100%",
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(122,107,85,0.18)",
  },
  partyMetricBarFillHp: {
    height: "100%",
    backgroundColor: "#7a9252",
  },
  partyMetricBarFillMp: {
    height: "100%",
    backgroundColor: "#4f6f96",
  },
  partyMetricValue: {
    position: "absolute",
    right: 0,
    top: -7,
    width: 34,
    textAlign: "right",
    color: parchment.inkSoft,
    fontSize: 9,
    fontWeight: "500",
  },
  partyCardUnderline: {
    marginTop: 10,
    height: 1,
    backgroundColor: "rgba(196,168,112,0.24)",
  },
});
