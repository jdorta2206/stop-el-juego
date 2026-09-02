import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useSession } from '../session';

type Profile = {
  playerName: string;
  avatarColor?: string | null;
  totalScore: number;
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  longestStreak: number;
  isPremium: boolean;
  xp: number;
  level: number;
  coins: number;
  globalRank: number;
  monthlyScore: number;
};

export default function ProfileScreen() {
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!session?.playerId) return () => { active = false; };

    api.get(`/api/ranking/profile/${encodeURIComponent(session.playerId)}`)
      .then((data) => { if (active) setProfile(data as Profile); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el perfil'); });

    return () => { active = false; };
  }, [session?.playerId]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {!profile && !error ? <ActivityIndicator size="large" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {profile ? (
          <>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.playerName?.charAt(0)?.toUpperCase() || '?'}</Text>
            </View>
            <Text style={styles.name}>{profile.playerName}</Text>
            {profile.isPremium ? <Text style={styles.premium}>PREMIUM</Text> : null}

            <View style={styles.grid}>
              <Stat label="Nivel" value={profile.level} />
              <Stat label="XP" value={profile.xp} />
              <Stat label="Puntos" value={profile.totalScore} />
              <Stat label="Partidas" value={profile.gamesPlayed} />
              <Stat label="Victorias" value={profile.wins} />
              <Stat label="Ranking" value={`#${profile.globalRank}`} />
              <Stat label="Racha" value={profile.currentStreak} />
              <Stat label="Mejor racha" value={profile.longestStreak} />
              <Stat label="Monedas" value={profile.coins} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { alignItems: 'center', padding: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '900' },
  name: { marginTop: 12, fontSize: 26, fontWeight: '900' },
  premium: { marginTop: 6, fontSize: 12, fontWeight: '900' },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 28 },
  stat: { width: '31%', minHeight: 82, marginBottom: 12, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 8 },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { marginTop: 4, fontSize: 12, opacity: 0.65, textAlign: 'center' },
  error: { textAlign: 'center', marginTop: 24 },
});
