import { useCallback, useEffect, useState } from "react";
import { tacticsRepository } from "@/db/repositories/tacticsRepository";
import { TacticsRuleRecord } from "@/types/models";
import { usePartyStore } from "@/stores/partyStore";

const EMPTY_RULES: TacticsRuleRecord[] = [];

export const useTactics = (characterId: string) => {
  const [loading, setLoading] = useState(true);
  const rules = usePartyStore((state) =>
    characterId ? (state.tacticsMap[characterId] ?? EMPTY_RULES) : EMPTY_RULES
  );
  const setTactics = usePartyStore((state) => state.setTactics);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await tacticsRepository.listByCharacter(characterId);
    setTactics(characterId, list);
    setLoading(false);
  }, [characterId, setTactics]);

  const saveRules = useCallback(
    async (nextRules: TacticsRuleRecord[]) => {
      const normalized = nextRules
        .map((rule, index) => ({ ...rule, priority: index + 1 }))
        .sort((a, b) => a.priority - b.priority);
      await tacticsRepository.replaceForCharacter(characterId, normalized);
      await reload();
    },
    [characterId, reload]
  );

  useEffect(() => {
    if (characterId) {
      void reload();
    }
  }, [characterId, reload]);

  return { loading, rules, reload, saveRules };
};
