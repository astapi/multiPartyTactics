import type { DungeonReturnCondition, PartyMemberRecord } from "@/types/models";
import type { ExplorationRunPartyMember } from "@/stores/explorationRunStore";
import { hasTrait } from "@/features/guild/traits";

export const DEFAULT_DUNGEON_RETURN_CONDITION: DungeonReturnCondition = "ANY_MEMBER_DOWN";
export const DEFAULT_DUNGEON_ITEM_CAPACITY = 20;
export const PORTER_ITEM_CAPACITY_BONUS = 2;

export const DUNGEON_RETURN_CONDITIONS: DungeonReturnCondition[] = [
  "ANY_MEMBER_DOWN",
  "INVENTORY_FULL",
  "BEFORE_BOSS",
  "UNTIL_WIPE_OR_CLEAR",
];

export const normalizeDungeonReturnCondition = (
  value: string | null | undefined
): DungeonReturnCondition =>
  DUNGEON_RETURN_CONDITIONS.includes(value as DungeonReturnCondition)
    ? (value as DungeonReturnCondition)
    : DEFAULT_DUNGEON_RETURN_CONDITION;

export const calculateDungeonItemCapacity = (members: Array<Pick<PartyMemberRecord, "traitIds">>): number =>
  members.reduce(
    (capacity, member) => capacity + (hasTrait(member.traitIds, "PORTER") ? PORTER_ITEM_CAPACITY_BONUS : 0),
    DEFAULT_DUNGEON_ITEM_CAPACITY
  );

export const hasAnyDownMember = (members: Array<Pick<ExplorationRunPartyMember, "hp">>): boolean =>
  members.some((member) => member.hp <= 0);

export const isPartyWiped = (members: Array<Pick<ExplorationRunPartyMember, "hp">>): boolean =>
  members.length > 0 && members.every((member) => member.hp <= 0);
