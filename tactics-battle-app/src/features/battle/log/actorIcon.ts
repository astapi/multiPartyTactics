import type { ImageSourcePropType } from "react-native";
import { getClassById, isClassId } from "@/constants/classes";
import { getEnemyImage } from "@/constants/enemyImages";
import type { BattleLogRecord } from "@/types/models";

type LogPartyActor = {
  id: string;
  name: string;
  classId?: string;
};

type LogEnemyActor = {
  id: string;
  name: string;
};

const trimEncounterSuffix = (unitId: string): string =>
  unitId.replace(/^enemy_/, "").replace(/_\d+$/, "");

const resolveByActorId = (
  actorId: string | null | undefined,
  party: LogPartyActor[],
  enemies: LogEnemyActor[]
): ImageSourcePropType | null => {
  if (!actorId) return null;

  const partyMember = party.find((member) => member.id === actorId);
  if (partyMember?.classId && isClassId(partyMember.classId)) {
    return getClassById(partyMember.classId).image;
  }

  const enemy = enemies.find((unit) => unit.id === actorId);
  return enemy ? getEnemyImage(trimEncounterSuffix(enemy.id)) : null;
};

const resolveByActorName = (
  actorName: string,
  party: LogPartyActor[],
  enemies: LogEnemyActor[]
): ImageSourcePropType | null => {
  const partyMatches = party.filter((member) => member.name === actorName);
  const enemyMatches = enemies.filter((unit) => unit.name === actorName);
  if (partyMatches.length + enemyMatches.length !== 1) return null;

  const partyMember = partyMatches[0];
  if (partyMember?.classId && isClassId(partyMember.classId)) {
    return getClassById(partyMember.classId).image;
  }

  const enemy = enemyMatches[0];
  return enemy ? getEnemyImage(trimEncounterSuffix(enemy.id)) : null;
};

export const resolveBattleLogActorImage = (
  log: BattleLogRecord,
  party: LogPartyActor[],
  enemies: LogEnemyActor[]
): ImageSourcePropType | null => {
  if (log.actorName === "SYSTEM") return null;
  return (
    resolveByActorId(log.actorId, party, enemies) ??
    resolveByActorName(log.actorName, party, enemies)
  );
};
