import { useCallback, useEffect, useState } from "react";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { CharacterRecord } from "@/types/models";
import { usePartyStore } from "@/stores/partyStore";

export const useCharacters = () => {
  const [loading, setLoading] = useState(true);
  const characters = usePartyStore((state) => state.characters);
  const setCharacters = usePartyStore((state) => state.setCharacters);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await charactersRepository.list();
    setCharacters(list);
    setLoading(false);
  }, [setCharacters]);

  const saveCharacter = useCallback(
    async (record: CharacterRecord) => {
      await charactersRepository.upsert(record);
      await reload();
    },
    [reload]
  );

  const removeCharacter = useCallback(
    async (id: string) => {
      await charactersRepository.deleteById(id);
      await reload();
    },
    [reload]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    loading,
    characters,
    reload,
    saveCharacter,
    removeCharacter,
  };
};
