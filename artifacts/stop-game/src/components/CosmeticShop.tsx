import { useCallback, useMemo, useState } from "react";
import { usePlayer } from "@/hooks/use-player";
import { useInventory, type ShopItem } from "@/hooks/useInventory";
import { Button } from "@/components/ui";
import { toast } from "sonner";
import { Crown, Sparkles, Coins, ShoppingBag, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import { purchaseWorldCupPackOnPlay, detectPaymentChannel } from "@/lib/playBilling";
import { startPackCheckout, WORLD_CUP_PACK_PRICE_LABEL } from "@/lib/worldCupPack";
import { celebrateReward } from "@/lib/celebrate";

const CATEGORY_LABELS = { all: "Todos", avatar: "Avatares", frame: "Marcos", background: "Fondos" } as const;
type Category = keyof typeof CATEGORY_LABELS;

function ownedIds(inventory: any, kind: "avatar" | "frame" | "background") {
  return new Set((inventory?.owned?.[`${kind}s`] ?? []).map((item: any) => item.id));
}

export function CosmeticShop() {
  const { player } = usePlayer();
  const { inventory, refresh, buy, equip } = useInventory(player?.id || null);
  const [category, setCategory] = useState<Category>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [showWorldCup, setShowWorldCup] = useState(false);

  const shopItems = useMemo(() => {
    const items = (inventory?.shop ?? []) as ShopItem[];
    return category === "all" ? items : items.filter(item => item.kind === category);
  }, [inventory?.shop, category]);

  const worldCupItems = useMemo(
    () => ((inventory?.shop ?? []) as ShopItem[]).filter(item => item.id.includes("_wc_")),
    [inventory?.shop],
  );

  const isOwned = useCallback(
    (item: ShopItem) => ownedIds(inventory, item.kind).has(item.id),
    [inventory],
  );

  // The pack is owned only when the server inventory contains every World Cup cosmetic.
  // This avoids trusting a separate client-side "purchased" flag and prevents showing
  // a purchase action when the account already owns the complete pack.
  const worldCupOwned = useMemo(
    () => worldCupItems.length > 0 && worldCupItems.every(item => isOwned(item)),
    [worldCupItems, isOwned],
  );

  const isEquipped = useCallback(
    (item: ShopItem) => inventory?.equipped?.[item.kind] === item.id,
    [inventory],
  );

  const handleBuy = useCallback(async (item: ShopItem) => {
    if (!player?.id) {
      toast.error("Debes iniciar sesión para comprar con monedas.");
      return;
    }
    setBusy(item.id);
    try {
      const result = await buy(item.id);
      if (result?.error) {
        toast.error(result.error === "Insufficient coins" ? "No tienes suficientes monedas." : result.error);
        return;
      }
      await refresh();
      toast.success(`¡${item.label} comprado!`);
    } catch (error) {
      console.error("Error comprando cosmético:", error);
      toast.error("No se pudo completar la compra.");
    } finally {
      setBusy(null);
    }
  }, [buy, player?.id, refresh]);

  const handleEquip = useCallback(async (item: ShopItem) => {
    setBusy(`equip:${item.id}`);
    try {
      const result = await equip(item.kind, item.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      await refresh();
      toast.success("¡Cosmético equipado!");
    } catch (error) {
      console.error("Error equipando cosmético:", error);
      toast.error("No se pudo equipar.");
    } finally {
      setBusy(null);
    }
  }, [equip, refresh]);

  const handleWorldCupPack = useCallback(async () => {
    if (!player?.id) {
      toast.error("Debes iniciar sesión para comprar el Pack Mundial.");
      return;
    }
    if (worldCupOwned) {
      toast.info("Ya tienes el Pack Mundial.");
      return;
    }

    setBusy("pack_mundial");
    try {
      const channel = await detectPaymentChannel();
      if (channel === "play") {
        const result = await purchaseWorldCupPackOnPlay(player.id);
        if (!result.granted) throw new Error("No se pudo conceder el Pack Mundial.");
      } else {
        const { url } = await startPackCheckout({ playerId: player.id });
        if (!url) throw new Error("No se recibió la URL de pago.");
        window.location.href = url;
        return;
      }
      await refresh();
      celebrateReward();
      toast.success("¡Pack Mundial desbloqueado! 🎉");
    } catch (error: any) {
      if (error?.code !== "PURCHASE_CANCELLED" && error?.name !== "AbortError") {
        console.error("Error comprando Pack Mundial:", error);
        toast.error(error instanceof Error ? error.message : "No se pudo completar la compra.");
      }
    } finally {
      setBusy(null);
    }
  }, [player?.id, refresh, worldCupOwned]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-5xl">🌍</div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white">Pack Mundial</h3>
                <p className="text-white/80 text-sm">27 cosméticos exclusivos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowWorldCup(v => !v)} variant="outline" className="bg-white/10 text-white border-white/30 font-black px-4 py-3 rounded-xl">
                {showWorldCup ? <ChevronUp className="w-5 h-5 mr-2" /> : <ChevronDown className="w-5 h-5 mr-2" />}
                Ver contenido
              </Button>
              <Button
                onClick={handleWorldCupPack}
                disabled={busy === "pack_mundial" || worldCupOwned}
                className="bg-white text-black font-black px-5 py-3 rounded-xl shadow-lg"
              >
                <Crown className="w-5 h-5 mr-2 text-yellow-500" />
                {busy === "pack_mundial" ? "Procesando..." : worldCupOwned ? "Ya lo tienes" : WORLD_CUP_PACK_PRICE_LABEL}
              </Button>
            </div>
          </div>
          {showWorldCup && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="rounded-xl bg-black/20 border border-white/15 p-3 sm:p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {worldCupItems.map(item => {
                  const owned = isOwned(item);
                  return (
                    <div key={item.id} className="rounded-lg bg-white/10 border border-white/10 p-2 text-center min-w-0">
                      <div className="text-2xl">{item.glyph}</div>
                      <div className="text-white text-xs font-bold truncate">{item.label}</div>
                      <div className="text-white/50 text-[10px]">{owned ? "Desbloqueado" : `${item.price} 🪙`}</div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-center text-white/60 text-xs">El Pack Mundial desbloquea los cosméticos del evento. También puedes conseguirlos individualmente con monedas.</p>
            </motion.div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-black text-white">Tienda de monedas</h3>
            <span className="ml-1 px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 font-black text-sm">🪙 {inventory?.coins ?? 0}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map(key => (
              <button key={key} onClick={() => setCategory(key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${category === key ? "bg-yellow-500 text-black" : "bg-white/10 text-white/70"}`}>
                {CATEGORY_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {shopItems.length === 0 ? (
          <div className="py-10 text-center text-white/50">No hay artículos disponibles.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {shopItems.map(item => {
              const owned = isOwned(item);
              const equipped = isEquipped(item);
              const purchasing = busy === item.id;
              const equipping = busy === `equip:${item.id}`;
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/10 bg-black/20 p-3 min-w-0">
                  <div className="text-4xl text-center mb-2">{item.glyph}</div>
                  <p className="text-white font-bold text-sm text-center truncate">{item.label}</p>
                  <p className="text-white/40 text-[11px] text-center capitalize">{item.kind}</p>
                  {!owned && <div className="mt-2 flex items-center justify-center gap-1 text-yellow-300 font-black text-sm"><Coins className="w-3.5 h-3.5" />{item.price}</div>}
                  {owned && !equipped && <Button onClick={() => handleEquip(item)} disabled={equipping} variant="outline" className="w-full mt-2 py-1.5 text-xs border-white/20 text-white">{equipping ? "..." : "EQUIPAR"}</Button>}
                  {equipped && <div className="mt-2 py-1.5 text-center text-xs font-black text-yellow-300 flex items-center justify-center gap-1"><Sparkles className="w-3.5 h-3.5" />EQUIPADO</div>}
                  {!owned && <Button onClick={() => handleBuy(item)} disabled={purchasing} className="w-full mt-2 py-1.5 text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black">{purchasing ? "..." : "COMPRAR"}</Button>}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
