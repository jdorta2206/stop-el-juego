import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { DEFAULT_GAME_CONFIG, GAME_MODES, type NativeGameConfig, type CategoryPackId } from '../game/gameConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'GameSetup'>;

const PACKS: Array<{ id: CategoryPackId; label: string }> = [
  { id: 'classic', label: 'Clásico' },
  { id: 'football', label: 'Fútbol' },
  { id: 'cinema', label: 'Cine y TV' },
  { id: 'food', label: 'Comida' },
  { id: 'music', label: 'Música' },
  { id: 'geography', label: 'Geografía' },
  { id: 'science', label: 'Ciencia' },
  { id: 'history', label: 'Historia' },
];

export default function GameSetupScreen({ navigation }: Props) {
  const [config, setConfig] = useState<NativeGameConfig>(DEFAULT_GAME_CONFIG);
  const start = () => navigation.navigate('Game', { config });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Preparar partida</Text>
        <Text style={styles.subtitle}>Elige cómo quieres jugar.</Text>
        <Text style={styles.section}>Modo</Text>
        <View style={styles.row}>
          {GAME_MODES.map((mode) => (
            <Pressable key={mode.id} onPress={() => setConfig((c) => ({ ...c, mode: mode.id }))} style={[styles.option, config.mode === mode.id && styles.selected]}>
              <Text style={[styles.optionText, config.mode === mode.id && styles.selectedText]}>{mode.label}</Text>
              <Text style={[styles.small, config.mode === mode.id && styles.selectedText]}>{mode.seconds}s</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.section}>Categorías</Text>
        <View style={styles.grid}>
          {PACKS.map((pack) => (
            <Pressable key={pack.id} onPress={() => setConfig((c) => ({ ...c, categoryPack: pack.id }))} style={[styles.option, styles.gridItem, config.categoryPack === pack.id && styles.selected]}>
              <Text style={[styles.optionText, config.categoryPack === pack.id && styles.selectedText]}>{pack.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.start} onPress={start}><Text style={styles.startText}>EMPEZAR PARTIDA</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f7f7f7' }, content: { padding: 20, paddingBottom: 40 }, title: { fontSize: 30, fontWeight: '900' }, subtitle: { marginTop: 6, marginBottom: 24, opacity: 0.65, fontSize: 16 }, section: { marginTop: 14, marginBottom: 10, fontSize: 18, fontWeight: '800' }, row: { flexDirection: 'row', gap: 10 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, option: { minHeight: 58, flex: 1, minWidth: 130, borderWidth: 1, borderRadius: 14, padding: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }, gridItem: { flexGrow: 1, flexBasis: '44%' }, selected: { backgroundColor: '#111', borderColor: '#111' }, optionText: { fontSize: 16, fontWeight: '800' }, selectedText: { color: '#fff' }, small: { marginTop: 3, fontSize: 12, opacity: 0.65 }, start: { marginTop: 30, minHeight: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }, startText: { color: '#fff', fontSize: 17, fontWeight: '900' } });
