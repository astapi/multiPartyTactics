import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/common/Card";
import { CharacterSelectModal } from "@/components/party/CharacterSelectModal";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { CharacterRecord } from "@/types/models";

export default function PartyScreen() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const load = useCallback(async () => {
    const list = await charactersRepository.list();
    setCharacters(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const slotMap = new Map<number, CharacterRecord>();
  for (const c of characters) {
    if (c.slotIndex !== null) {
      slotMap.set(c.slotIndex, c);
    }
  }

  const onSelectCharacter = async (character: CharacterRecord) => {
    if (selectedSlot === null) return;
    await charactersRepository.assignToSlot(character.id, selectedSlot);
    await load();
    setSelectedSlot(null);
  };

  const onClearSlot = async () => {
    if (selectedSlot === null) return;
    const current = slotMap.get(selectedSlot);
    if (current) {
      await charactersRepository.removeFromSlot(current.id);
      await load();
    }
    setSelectedSlot(null);
  };

  const partyMembers = Array.from({ length: 6 }).map((_, index) => slotMap.get(index));
  const memberCount = partyMembers.filter(Boolean).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>PT編成</Text>
      <Text style={styles.subtitle}>編成中: {memberCount}/6</Text>

      <View style={styles.slotList}>
        {partyMembers.map((character, index) => (
          <Pressable
            key={index}
            style={styles.slotPressable}
            onPress={() => setSelectedSlot(index)}
          >
            <Card style={styles.slotCard}>
              <Text style={styles.slotLabel}>スロット {index + 1}</Text>
              {character ? (
                <>
                  <Text style={styles.characterName}>{character.name}</Text>
                  <Text style={styles.characterJob}>{character.jobId}</Text>
                  <View style={styles.statsRow}>
                    <Text style={styles.statText}>HP: {character.baseMaxHp}</Text>
                    <Text style={styles.statText}>ATK: {character.baseAtk}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>タップしてキャラクターを配置</Text>
              )}
            </Card>
          </Pressable>
        ))}
      </View>

      <CharacterSelectModal
        visible={selectedSlot !== null}
        characters={characters}
        slotIndex={selectedSlot ?? 0}
        onSelect={onSelectCharacter}
        onClear={onClearSlot}
        onClose={() => setSelectedSlot(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  content: { padding: 16 },
  title: { marginBottom: 4, fontSize: 28, fontWeight: "700", color: "#ffffff" },
  subtitle: { marginBottom: 16, fontSize: 14, color: "#a1a1aa" },
  slotList: { gap: 12 },
  slotPressable: { borderRadius: 16 },
  slotCard: { marginBottom: 0 },
  slotLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
  },
  characterName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  characterJob: {
    marginTop: 2,
    color: "#a1a1aa",
  },
  statsRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 16,
  },
  statText: {
    fontSize: 12,
    color: "#d4d4d8",
  },
  emptyText: {
    paddingVertical: 12,
    color: "#71717a",
  },
});
