import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BattleLogList } from "@/components/battle/BattleLogList";
import { UnitStatusBar } from "@/components/battle/UnitStatusBar";
import { battleRepository } from "@/db/repositories/battleRepository";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { tacticsRepository } from "@/db/repositories/tacticsRepository";
import { Unit } from "@/game/battle";
import { simulateBattle } from "@/game/battleSimulation";
import { EncounterResult, generateEncounter } from "@/game/encounter";
import { toUnit } from "@/game/partyMapper";
import { DEFAULT_SKILLS, createBattleSessionId, createSkillMap } from "@/game/simulator";
import { TacticsRuleRecord } from "@/types/models";
import { useBattleStore } from "@/stores/battleStore";

const parseEncounter = (raw: string | undefined): EncounterResult | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EncounterResult;
  } catch {
    return null;
  }
};

export default function BattleScreen() {
  const { dungeonId, floor, explorationSeed, encounter } = useLocalSearchParams<{
    dungeonId?: string;
    floor?: string;
    explorationSeed?: string;
    encounter?: string;
  }>();

  const [ready, setReady] = useState(false);
  const [party, setParty] = useState<Unit[]>([]);
  const [enemies, setEnemies] = useState<Unit[]>([]);
  const [turns, setTurns] = useState(0);
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
      try {
        const selected = await charactersRepository.listPartyMembers();
        if (selected.length === 0) {
          console.warn("No party members found, cannot start battle");
          setStatus("LOSE");
          setReady(true);
          return;
        }
        const units = selected.map(toUnit);
        const map: Record<string, TacticsRuleRecord[]> = {};
        for (const unit of units) {
          map[unit.id] = await tacticsRepository.listByCharacter(unit.id);
        }
        const nextSessionId = createBattleSessionId();
        const parsedFloor = Math.max(1, Number.parseInt(floor ?? "1", 10) || 1);
        const parsedSeed = explorationSeed ? Number.parseInt(explorationSeed, 10) : Date.now();
        const resolvedDungeonId = dungeonId ?? "crestoria_dungeon_1_4";
        const encounterData =
          parseEncounter(encounter) ??
          generateEncounter({
            dungeonId: resolvedDungeonId,
            floor: parsedFloor,
            seed: (parsedSeed + parsedFloor * 1009) >>> 0,
          });

        await battleRepository.createSession({
          id: nextSessionId,
          dungeonId: resolvedDungeonId,
          floor: parsedFloor,
          turn: 1,
          status: "IN_PROGRESS",
          explorationSeed: Number.isFinite(parsedSeed) ? parsedSeed : null,
          startedAt: new Date().toISOString(),
          endedAt: null,
        });

        const result = simulateBattle({
          sessionId: nextSessionId,
          seed: (parsedSeed + 17) >>> 0,
          party: units,
          enemies: encounterData.enemies,
          tacticsByCharacter: map,
          skillMap,
          maxTurns: 50,
        });

        await battleRepository.appendLogs(result.logs);
        await battleRepository.updateSessionStatus(nextSessionId, result.outcome);

        setParty(result.finalParty);
        setEnemies(result.finalEnemies);
        setSessionId(nextSessionId);
        setStatus(result.outcome);
        setLogs(result.logs);
        setTurns(result.turns);
        setReady(true);
      } catch (error) {
        console.error("Failed to load battle:", error);
        setStatus("LOSE");
        setReady(true);
      }
    };
    void load();
  }, [dungeonId, encounter, explorationSeed, floor, reset, setLogs, setSessionId, setStatus, skillMap]);

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>戦闘シミュレーション中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>戦闘結果</Text>
      <Text style={styles.status}>Status: {status} / Turns: {turns}</Text>
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
        {enemies.map((unit) => (
          <UnitStatusBar
            key={unit.id}
            name={unit.name}
            hp={unit.hp}
            maxHp={unit.stats.maxHp}
            mp={unit.mp}
            maxMp={unit.stats.maxMp}
          />
        ))}
      </ScrollView>
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
  statusList: { marginBottom: 12, maxHeight: 280 },
});
