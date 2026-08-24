import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useInventory, type ShopItem } from "./useInventory";
import { IOS_PRODUCT_IDS } from "./iap";
import type { StopSession } from "./auth";

export function ShopScreen({ session, onExit }: { session: StopSession; onExit: () => void }) {
  const { inventory, loading, refresh, buy, equip } = useInventory(session.user.id);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"shop" | "owned">("shop");

  useEffect(() => { void refresh(); }, [refresh]);

  const ownedIds = useMemo(() => new Set([
    ...(inventory?.owned.avatars ?? []).map(x => x.id),
    ...(inventory?.owned.frames ?? []).map(x => x.id),
    ...(inventory?.owned.backgrounds ?? []).map(x => x.id),
  ]), [inventory]);
  const worldCup = useMemo(() => (inventory?.shop ?? []).filter(item => item.id.includes("_wc_")), [inventory]);

  async function handleBuy(item: ShopItem) {
    if (busyId) return;
    setBusyId(item.id);
    try { await buy(item.id); await refresh(); }
    catch (error) { Alert.alert("No se pudo comprar", error instanceof Error ? error.message : "Error de compra"); }
    finally { setBusyId(null); }
  }

  async function handleEquip(item: ShopItem) {
    if (busyId) return;
    setBusyId(item.id);
    try { await equip(item.kind, item.id); await refresh(); }
    catch (error) { Alert.alert("No se pudo equipar", error instanceof Error ? error.message : "Error"); }
    finally { setBusyId(null); }
  }

  const renderItem = ({ item }: { item: ShopItem }) => {
    const owned = ownedIds.has(item.id);
    const equipped = inventory?.equipped[item.kind === "avatar" ? "avatar" : item.kind === "frame" ? "frame" : "background"] === item.id;
    return <View style={styles.card}>
      <View style={styles.icon}><Text style={styles.glyph}>{item.glyph}</Text></View>
      <Text style={styles.itemName}>{item.label}</Text>
      <Text style={styles.price}>🪙 {item.price.toLocaleString("es-ES")}</Text>
      {owned ? <TouchableOpacity style={[styles.action, equipped && styles.actionDisabled]} disabled={equipped || !!busyId} onPress={() => void handleEquip(item)}><Text style={styles.actionText}>{equipped ? "Equipado ✓" : "Equipar"}</Text></TouchableOpacity>
        : <TouchableOpacity style={styles.action} disabled={!!busyId || (inventory?.coins ?? 0) < item.price} onPress={() => void handleBuy(item)}><Text style={styles.actionText}>{busyId === item.id ? "…" : "Comprar"}</Text></TouchableOpacity>}
    </View>;
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><TouchableOpacity onPress={onExit}><Text style={styles.back}>‹</Text></TouchableOpacity><View style={styles.headerCenter}><Text style={styles.title}>🛍️ Tienda</Text><Text style={styles.coins}>🪙 {(inventory?.coins ?? 0).toLocaleString("es-ES")}</Text></View><TouchableOpacity onPress={() => void refresh()}><Text style={styles.refresh}>↻</Text></TouchableOpacity></View>
    <View style={styles.tabs}><TouchableOpacity style={[styles.tab,tab==="shop"&&styles.tabActive]} onPress={()=>setTab("shop")}><Text style={[styles.tabText,tab==="shop"&&styles.tabTextActive]}>Comprar</Text></TouchableOpacity><TouchableOpacity style={[styles.tab,tab==="owned"&&styles.tabActive]} onPress={()=>setTab("owned")}><Text style={[styles.tabText,tab==="owned"&&styles.tabTextActive]}>Mi colección</Text></TouchableOpacity></View>
    <View style={styles.pack}><View style={styles.packText}><Text style={styles.packTitle}>🏆 Pack Mundial</Text><Text style={styles.packDesc}>{worldCup.length || 27} cosméticos · 2,99 €</Text><Text style={styles.packHint}>Producto preparado para App Store: {IOS_PRODUCT_IDS.worldCupPack}</Text></View><View style={styles.packButton}><Text style={styles.packButtonText}>App Store</Text><Text style={styles.packPending}>Pendiente de configurar</Text></View></View>
    {loading && !inventory ? <View style={styles.loader}><ActivityIndicator size="large"/><Text style={styles.muted}>Cargando tienda…</Text></View> : tab === "shop" ? <FlatList data={inventory?.shop ?? []} keyExtractor={item=>item.id} numColumns={2} contentContainerStyle={styles.list} columnWrapperStyle={styles.columns} renderItem={renderItem} ListEmptyComponent={<Text style={styles.empty}>La tienda no está disponible ahora.</Text>} /> : <FlatList data={[...(inventory?.owned.avatars ?? []),...(inventory?.owned.frames ?? []),...(inventory?.owned.backgrounds ?? [])].map(x=>({...x,price:0}))} keyExtractor={item=>item.id} numColumns={2} contentContainerStyle={styles.list} columnWrapperStyle={styles.columns} renderItem={({item})=><View style={styles.card}><View style={styles.icon}><Text style={styles.glyph}>{item.glyph}</Text></View><Text style={styles.itemName}>{item.label}</Text><Text style={styles.owned}>Desbloqueado ✓</Text><TouchableOpacity style={styles.action} onPress={()=>void handleEquip(item)}><Text style={styles.actionText}>Equipar</Text></TouchableOpacity></View>} ListEmptyComponent={<Text style={styles.empty}>Todavía no tienes cosméticos desbloqueados.</Text>} />}
  </SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:"#f7f8fc"},header:{flexDirection:"row",alignItems:"center",paddingHorizontal:18,paddingTop:14,paddingBottom:10},back:{fontSize:38,color:"#151f63",width:42},headerCenter:{flex:1},title:{fontSize:25,fontWeight:"900"},coins:{color:"#a46b00",fontWeight:"900",marginTop:2},refresh:{fontSize:28,color:"#151f63"},tabs:{flexDirection:"row",marginHorizontal:18,backgroundColor:"#e9ebf2",borderRadius:12,padding:3},tab:{flex:1,paddingVertical:10,alignItems:"center",borderRadius:10},tabActive:{backgroundColor:"white"},tabText:{fontWeight:"700",color:"#666b78"},tabTextActive:{color:"#151f63"},pack:{margin:14,marginBottom:8,padding:14,borderRadius:16,backgroundColor:"#fff8e7",borderWidth:1,borderColor:"#efd08a",flexDirection:"row",alignItems:"center"},packText:{flex:1},packTitle:{fontSize:17,fontWeight:"900"},packDesc:{fontSize:13,fontWeight:"700",marginTop:3},packHint:{fontSize:9,color:"#777b89",marginTop:5},packButton:{backgroundColor:"#e9ebf2",paddingHorizontal:9,paddingVertical:8,borderRadius:10,alignItems:"center"},packButtonText:{fontSize:11,fontWeight:"900"},packPending:{fontSize:8,color:"#777b89",marginTop:2},list:{padding:14,paddingTop:6,paddingBottom:35},columns:{gap:10},card:{flex:1,minHeight:190,backgroundColor:"white",borderRadius:16,padding:12,alignItems:"center",marginBottom:10,borderWidth:1,borderColor:"#e4e6ed"},icon:{width:66,height:66,borderRadius:33,backgroundColor:"#f0f2f7",alignItems:"center",justifyContent:"center",marginBottom:8},glyph:{fontSize:34},itemName:{fontSize:13,fontWeight:"900",textAlign:"center",minHeight:34},price:{fontSize:12,fontWeight:"800",color:"#a46b00",marginTop:4},owned:{fontSize:11,color:"#15803d",fontWeight:"800",marginTop:5},action:{minHeight:38,minWidth:105,paddingHorizontal:12,borderRadius:10,backgroundColor:"#151f63",alignItems:"center",justifyContent:"center",marginTop:"auto"},actionDisabled:{backgroundColor:"#c9cbd2"},actionText:{color:"white",fontWeight:"900",fontSize:12},loader:{flex:1,alignItems:"center",justifyContent:"center"},muted:{color:"#777b89",marginTop:10},empty:{textAlign:"center",color:"#777b89",marginTop:35,padding:20}});
