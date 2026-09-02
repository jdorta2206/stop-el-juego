import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { authenticatedFetch } from '../auth';
import { useSession } from '../session';

type Friend = { followerId: string; followedId: string; followedName?: string; followedPicture?: string | null; followedAvatarColor?: string; followedProvider?: string | null; equippedAvatar?: string | null; equippedFrame?: string | null; equippedBackground?: string | null; isPremium?: boolean };
type Response = { friends: Friend[] };
type Props = { navigation: { goBack: () => void } };

export default function FriendsScreen({ navigation }: Props) {
  const { session } = useSession();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.playerId) return;
    setLoading(true); setError(null);
    try {
      const result = await authenticatedFetch<Response>(`/api/friends/list/${encodeURIComponent(session.playerId)}`);
      setFriends(Array.isArray(result.friends) ? result.friends : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los amigos');
    } finally { setLoading(false); }
  }, [session?.playerId]);

  useEffect(() => { void load(); }, [load]);

  const unfollow = async (friend: Friend) => {
    if (!session?.playerId) return;
    setBusy(friend.followedId); setError(null);
    try {
      await authenticatedFetch('/api/friends/unfollow', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followerId: session.playerId, followedId: friend.followedId }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dejar de seguir');
    } finally { setBusy(null); }
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><Pressable onPress={navigation.goBack}><Text>‹ Atrás</Text></Pressable><Text style={styles.title}>Amigos</Text><View /></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {loading ? <ActivityIndicator style={styles.loader} /> : <ScrollView contentContainerStyle={styles.list}>
      {friends.map(friend => <View key={friend.followedId} style={styles.card}>
        <View style={[styles.avatar, { backgroundColor: friend.followedAvatarColor || '#e53e3e' }]}><Text style={styles.avatarText}>{(friend.followedName || '?').slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.info}><Text style={styles.name}>{friend.followedName || friend.followedId}</Text>{friend.isPremium ? <Text style={styles.premium}>PREMIUM</Text> : null}</View>
        <Pressable style={styles.button} disabled={busy === friend.followedId} onPress={() => void unfollow(friend)}><Text style={styles.buttonText}>{busy === friend.followedId ? '…' : 'Dejar de seguir'}</Text></Pressable>
      </View>)}
      {!friends.length ? <Text style={styles.empty}>Todavía no sigues a ningún jugador.</Text> : null}
    </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#fff'}, header:{padding:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, title:{fontSize:24,fontWeight:'900'}, list:{padding:16,gap:12}, card:{borderWidth:1,borderRadius:14,padding:14,flexDirection:'row',alignItems:'center'}, avatar:{width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center'}, avatarText:{color:'#fff',fontWeight:'900',fontSize:20}, info:{flex:1,marginLeft:12}, name:{fontSize:16,fontWeight:'800'}, premium:{marginTop:3,fontSize:11,fontWeight:'900'}, button:{borderWidth:1,borderRadius:9,paddingHorizontal:10,paddingVertical:8}, buttonText:{fontSize:12,fontWeight:'700'}, loader:{marginTop:40}, error:{margin:18,textAlign:'center'}, empty:{textAlign:'center',marginTop:30,opacity:.65} });
