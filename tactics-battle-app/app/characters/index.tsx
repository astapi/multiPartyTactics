import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/common/Card";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { CharacterRecord } from "@/types/models";

export default function CharactersScreen() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      const list = await charactersRepository.list();
      setCharacters(list);
    };
    void load();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>キャラクター一覧</Text>
      <Link href="/characters/new" asChild>
        <Pressable style={styles.createButton}>
          <Text style={styles.createButtonText}>新規作成</Text>
        </Pressable>
      </Link>
      <View style={styles.list}>
        {characters.length === 0 ? (
          <Text style={styles.emptyText}>キャラクターがいません</Text>
        ) : (
          characters.map((character) => (
            <Link
              key={character.id}
              href={`/characters/${character.id}`}
              asChild
            >
              <Pressable>
                <Card>
                  <View style={styles.cardHeader}>
                    <Text style={styles.characterName}>{character.name}</Text>
                    {character.slotIndex !== null && (
                      <Text style={styles.slotBadge}>PT {character.slotIndex + 1}</Text>
                    )}
                  </View>
                  <Text style={styles.jobText}>Job: {character.jobId}</Text>
                  <Text style={styles.levelText}>Lv.{character.level}</Text>
                </Card>
              </Pressable>
            </Link>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  content: { padding: 16 },
  title: { marginBottom: 16, fontSize: 28, fontWeight: "700", color: "#ffffff" },
  createButton: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createButtonText: {
    textAlign: "center",
    fontWeight: "600",
    color: "#ffffff",
  },
  list: { gap: 12 },
  emptyText: { color: "#71717a" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  characterName: { fontSize: 18, fontWeight: "600", color: "#ffffff" },
  slotBadge: {
    borderRadius: 8,
    backgroundColor: "#0369a1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  jobText: { marginTop: 4, color: "#a1a1aa" },
  levelText: { marginTop: 2, color: "#71717a" },
});
