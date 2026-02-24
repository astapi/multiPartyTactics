import { FlashList } from "@shopify/flash-list";
import { StyleSheet, Text, View } from "react-native";
import { formatBattleLogMessage } from "@/game/battleLog";
import { useI18n } from "@/i18n";
import { BattleLogRecord } from "@/types/models";

type Props = {
  logs: BattleLogRecord[];
};

export const BattleLogList = ({ logs }: Props) => {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <FlashList
        data={logs}
        estimatedItemSize={42}
        keyExtractor={(item, index) => `${item.id ?? index}-${item.turn}`}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.turn}>{t("battle.log.turn", { turn: item.turn })}</Text>
            <Text style={styles.message}>{formatBattleLogMessage(item, t)}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#09090b",
    padding: 8,
  },
  item: {
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#18181b",
    padding: 8,
  },
  turn: { fontSize: 12, color: "#a1a1aa" },
  message: { fontSize: 15, lineHeight: 21, color: "#f4f4f5" },
});
