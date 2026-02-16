import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BattleLogList } from "@/components/battle/BattleLogList";
import { UnitStatusBar } from "@/components/battle/UnitStatusBar";
import { Button } from "@/components/common/Button";
import { battleRepository } from "@/db/repositories/battleRepository";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { tacticsRepository } from "@/db/repositories/tacticsRepository";
import { Unit } from "@/game/battle";
import { toUnit } from "@/game/partyMapper";
import {
  DEFAULT_SKILLS,
  createBattleSessionId,
  createBossUnit,
  createSkillMap,
  runBattleTurn,
} from "@/game/simulator";
import { TacticsRuleRecord } from "@/types/models";
import { useBattleStore } from "@/stores/battleStore";

export default function BattleScreen() {
  const router = useRouter();
  const { progressId } = useLocalSearchParams<{ progressId: string }>();
  const [turn, setTurn] = useState(1);
  const [ready, setReady] = useState(false);
  const [party, setParty] = useState<Unit[]>([]);
  const [boss, setBoss] = useState(createBossUnit());
  const [tacticsByCharacter, setTacticsByCharacter] = useState<
    Record<string, TacticsRuleRecord[]>
  >({});
  const sessionId = useBattleStore((s) => s.sessionId);
  const setSessionId = useBattleStore((s) => s.setSessionId);
  const logs = useBattleStore((s) => s.logs);
  const setLogs = useBattleStore((s) => s.setLogs);
  const setStatus = useBattleStore((s) => s.setStatus);
  const status = useBattleStore((s) => s.status);
  const reset = useBattleStore((s) => s.reset);

  const skillMap = useMemo(() => createSkillMap(DEFAULT_SKILLS), []);

  useEffect(() => {
    const load = async () => {
      reset();
      const selected = await charactersRepository.listPartyMembers();
      const units = selected.map(toUnit);
      const map: Record<string, TacticsRuleRecord[]> = {};
      for (const unit of units) {
        map[unit.id] = await tacticsRepository.listByCharacter(unit.id);
      }
      const nextSessionId = createBattleSessionId();
      await battleRepository.createSession({
        id: nextSessionId,
        dungeonProgressId: progressId ?? null,
        turn: 1,
        status: "IN_PROGRESS",
      });

      setParty(units);
      setBoss(createBossUnit());
      setTacticsByCharacter(map);
      setSessionId(nextSessionId);
      setStatus("IN_PROGRESS");
      setLogs([]);
      setTurn(1);
      setReady(true);
    };
    void load();
  }, [progressId, reset, setLogs, setSessionId, setStatus]);

  const onRunTurn = async () => {
    if (!sessionId || !ready || party.length === 0 || status !== "IN_PROGRESS") return;

    const result = runBattleTurn({
      sessionId,
      turn,
      party,
      boss,
      tacticsByCharacter,
      skillMap,
    });
    const withId = result.logs.map((log) => ({ ...log, id: undefined }));
    await battleRepository.appendLogs(withId);
    setLogs([...logs, ...withId]);
    setTurn((prev) => prev + 1);

    if (result.battleEnded) {
      const nextStatus = result.winner === "party" ? "WIN" : "LOSE";
      setStatus(nextStatus);
      await battleRepository.updateSessionStatus(sessionId, nextStatus);
      router.replace({
        pathname: "/result",
        params: { status: nextStatus, sessionId },
      });
    }
  };

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>戦闘準備中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>戦闘 Turn {turn}</Text>
      <Text style={styles.status}>Status: {status}</Text>
      <ScrollView style={styles.statusList}>
        {party.map((unit) => (
          <UnitStatusBar
            key={unit.id}
            name={unit.name}
            hp={unit.hp}
            maxHp={unit.stats.maxHp}
            mp={unit.mp}
            maxMp={unit.stats.maxMp}
          />
        ))}
        <UnitStatusBar
          name={boss.name}
          hp={boss.hp}
          maxHp={boss.stats.maxHp}
          mp={boss.mp}
          maxMp={boss.stats.maxMp}
        />
      </ScrollView>
      <View style={styles.turnButtonWrap}>
        <Button label="1ターン進行" onPress={() => void onRunTurn()} disabled={status !== "IN_PROGRESS"} />
      </View>
      <BattleLogList logs={logs} />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#09090b",
  },
  loadingText: { color: "#d4d4d8" },
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  title: { marginBottom: 8, fontSize: 20, fontWeight: "600", color: "#ffffff" },
  status: { marginBottom: 12, color: "#a1a1aa" },
  statusList: { marginBottom: 12, maxHeight: 224 },
  turnButtonWrap: { marginBottom: 12 },
});
