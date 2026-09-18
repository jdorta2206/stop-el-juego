import { useState, useCallback, useEffect } from "react";
import { usePlayer } from "@/hooks/use-player";
import { useInventory, type ShopItem as InventoryShopItem, type TitleView } from "@/hooks/useInventory";
import { Button } from "@/components/ui";
import { toast } from "sonner";
import { Check, Sparkles, Coins, ShoppingBag, Tag } from "lucide-react";
import { motion } from "framer-motion";
import { purchaseWorldCupPackOnPlay, detectPaymentChannel } from "@/lib/playBilling";
import { startPackCheckout, WORLD_CUP_PACK_PRICE_LABEL } from "@/lib/worldCupPack";
import { celebrateReward } from "@/lib/celebrate";

type Category = "all" | "avatar" | "frame" | "background";

const RARITY_BG: Record<string, string> = {
  common: "bg-gray-500/20 border-gray-500/30",
  rare: "bg-blue-500/20 border-blue-500/30",
  epic: "bg-purple-500/20 border-purple-500/30",
  legendary: "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30",
};

const WC_MARKER = "_wc_";

interface CosmeticShopProps {
  playerId?: string;
  inventory?: any;
  refresh?: () => void;
  buy?: (itemId: string) => void;
  equip?: (kind: string, value: string | null) => void;
  showInventory?: boolean;
}

export function CosmeticShop(_props: CosmeticShopProps) {
  const { player } = usePlayer();
  const { inventory, refresh: refreshInventory, buy, equip } = useInventory(player?.id || null);
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);

  const coinItems = ((inventory?.shop ?? []) as InventoryShopItem[]).filter(
    (item) => item.price > 0 && !item.id.includes(WC_MARKER),
  );
  const worldCupItems = ((inventory?.shop ?? []) as InventoryShopItem[]).filter(
    (item) => item.id.includes(WC_MARKER),
  );
  const weeklyShop = ((inventory?.weeklyShop ?? []) as InventoryShopItem[]).filter((item) => item.price > 0 && !item.id.includes(WC_MARKER));
  const weeklyDeals = inventory?.weeklyDeals ?? [];
  const shopResetAt = inventory?.shopResetAt ?? null;

  const filteredItems = weeklyShop.filter((item) =>
    selectedCategory === "all" ? true : item.kind === selectedCategory,
  );

  const isOwned = (itemId: string) =>
    [
      ...(inventory?.owned?.avatars ?? []),
      ...(inventory?.owned?.frames ?? []),
      ...(inventory?.owned?.backgrounds ?? []),
    ].some((item: { id: string }) => item.id === itemId);

  const isEquipped = (itemId: string) =>
    Object.values(inventory?.equipped ?? {}).includes(itemId);

  const dealFor = (itemId: string) =>
    weeklyDeals.find((deal: { id: string }) => deal.id === itemId);

  const handleBuy = useCallback(async (item: InventoryShopItem) => {
    if (!player?.id) {
      toast.error("Debes iniciar sesión");
      return;
    }

    setPurchasing(item.id);
    try {
      const result = await buy(item.id);
      if (result?.error) {
        toast.error(result.error === "Insufficient coins" ? "No tienes suficientes monedas" : result.error);
        return;
      }
      await refreshInventory();
      toast.success(`¡${item.label} adquirido! 🪙`);
    } catch (error) {
      console.error("Error comprando cosmético:", error);
      toast.error("No se pudo completar la compra");
    } finally {
      setPurchasing(null);
    }
  }, [buy, player?.id, refreshInventory]);

  const handleEquip = useCallback(async (kind: string, value: string | null) => {
    setEquipping(`${kind}:${value}`);
    try {
      const result = await equip(kind as "avatar" | "frame" | "title" | "background", value);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      await refreshInventory();
      toast.success("¡Cosmético equipado!");
    } catch (error) {
      console.error("Error equipando:", error);
      toast.error("Error al equipar");
    } finally {
      setEquipping(null);
    }
  }, [equip, refreshInventory]);

  const hasWorldCupPack =
    worldCupItems.length > 0 && worldCupItems.every((item) => isOwned(item.id));
  const isInApp = detectPaymentChannel() === "play";

  const handleBuyPack = useCallback(async () => {
    setPurchasing("pack_mundial");
    try {
      if (isInApp) {
        const result = await purchaseWorldCupPackOnPlay(player?.id || "");
        if (result.granted) {
          await refreshInventory();
          celebrateReward();
          window.alert("¡Pack Mundial desbloqueado! 🎉");
          return;
        }
        throw new Error("No se pudo completar la compra con Google Play.");
      }

      const { url } = await startPackCheckout({ playerId: player?.id || "" });
      if (url) window.location.href = url;
      else throw new Error("No se recibió URL de Stripe");
    } catch (error: any) {
      if (error?.code === "PURCHASE_CANCELLED" || error?.name === "AbortError") return;
      console.error("Error al comprar Pack Mundial:", error);
      window.alert(error instanceof Error ? error.message : "No se pudo completar la compra");
    } finally {
      setPurchasing(null);
    }
  }, [isInApp, player?.id, refreshInventory]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-amber-400" />
              <h2 className="text-xl sm:text-2xl font-black text-white">Tienda de monedas</h2>
            </div>
            <p className="text-white/60 text-sm mt-1">Juega, consigue monedas y desbloquea cosméticos.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <span className="text-amber-300 font-black">{inventory?.coins ?? 0}</span>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "all", label: "Todos", icon: "🎨" },
          { id: "avatar", label: "Avatares", icon: "👤" },
          { id: "frame", label: "Marcos", icon: "🖼️" },
          { id: "background", label: "Fondos", icon: "🌅" },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id as Category)}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${selectedCategory === cat.id ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
          >
            <span>{cat.icon}</span>{cat.label}
          </button>
        ))}
      </div>

      {weeklyShop.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-black text-white">🔥 Ofertas de hoy</h3>
            <span className="text-xs text-white/40">Precios válidos durante la oferta</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {weeklyDeals.map((deal: { id: string; originalPrice: number; price: number; discountPct: number }) => {
              const item = weeklyShop.find((candidate) => candidate.id === deal.id);
              if (!item) return null;
              return (
                <ShopCard
                  key={item.id}
                  item={item}
                  owned={isOwned(item.id)}
                  equipped={isEquipped(item.id)}
                  purchasing={purchasing === item.id}
                  equipping={equipping === `${item.kind}:${item.id}`}
                  deal={deal}
                  onBuy={() => handleBuy(item)}
                  onEquip={() => handleEquip(item.kind, item.id)}
                />
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-lg font-black text-white mb-3">🪙 Productos disponibles esta semana</h3>
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">
            No hay cosméticos disponibles ahora mismo.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredItems.map((item) => (
              <ShopCard
                key={item.id}
                item={item}
                owned={isOwned(item.id)}
                equipped={isEquipped(item.id)}
                purchasing={purchasing === item.id}
                equipping={equipping === `${item.kind}:${item.id}`}
                deal={dealFor(item.id)}
                onBuy={() => handleBuy(item)}
                onEquip={() => handleEquip(item.kind, item.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Colección del jugador: los cosméticos comprados siguen siendo equipables aunque salgan de la rotación semanal. */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-secondary" />
          <h3 className="text-lg font-black text-white">✨ Mi colección</h3>
          <span className="text-xs text-white/40">Cambia lo que llevas en tu perfil</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ...(inventory?.owned?.avatars ?? []).map((item: InventoryShopItem) => ({ ...item, kind: "avatar" as const })),
            ...(inventory?.owned?.frames ?? []).map((item: InventoryShopItem) => ({ ...item, kind: "frame" as const })),
            ...(inventory?.owned?.backgrounds ?? []).map((item: InventoryShopItem) => ({ ...item, kind: "background" as const })),
          ].map((item) => (
            <ShopCard key={`owned-${item.id}`} item={item} owned={true}
              equipped={isEquipped(item.id)} purchasing={false}
              equipping={equipping === `${item.kind}:${item.id}`}
              onBuy={() => {}} onEquip={() => handleEquip(item.kind, item.id)} />
          ))}
        </div>
        {(inventory?.titles ?? []).some((title: TitleView) => title.unlocked) && (
          <div className="mt-4">
            <h4 className="text-sm font-black text-white/80 mb-2">🏷️ Títulos desbloqueados</h4>
            <div className="flex flex-wrap gap-2">
              {(inventory?.titles ?? []).filter((title: TitleView) => title.unlocked).map((title: TitleView) => {
                const equipped = inventory?.equipped?.title === title.id;
                return (
                  <Button key={`title-${title.id}`} onClick={() => handleEquip("title", title.id)}
                    disabled={equipping === `title:${title.id}`} variant={equipped ? "default" : "outline"}
                    className={equipped ? "text-black font-bold" : "border-white/20 text-white/80"}>
                    {title.icon} {title.label}{equipped ? " ✓" : ""}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 p-5 shadow-2xl">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-5xl">🌍</div>
            <div>
              <h3 className="text-xl font-black text-white">Pack Mundial</h3>
              <p className="text-white/80 text-sm">Contenido exclusivo del Mundial</p>
              <p className="text-white/60 text-xs mt-1">{worldCupItems.length} cosméticos exclusivos</p>
            </div>
          </div>
          {hasWorldCupPack ? (
            <div className="bg-green-500/20 px-5 py-3 rounded-xl border border-green-400 text-green-300 font-bold">
              <Check className="inline w-5 h-5 mr-1" /> ¡Ya lo tienes!
            </div>
          ) : (
            <Button onClick={handleBuyPack} disabled={purchasing === "pack_mundial"} className="bg-white text-black hover:bg-white/90 font-bold px-6 py-4 rounded-xl">
              {purchasing === "pack_mundial" ? "Procesando..." : isInApp ? "Pagar con Google Play" : WORLD_CUP_PACK_PRICE_LABEL}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function ShopCard({
  item,
  owned,
  equipped,
  purchasing,
  equipping,
  deal,
  onBuy,
  onEquip,
}: {
  item: InventoryShopItem;
  owned: boolean;
  equipped: boolean;
  purchasing: boolean;
  equipping: boolean;
  deal?: { id: string; originalPrice: number; price: number; discountPct: number };
  onBuy: () => void;
  onEquip: () => void;
}) {
  const price = deal?.price ?? item.price;
  const original = deal?.originalPrice ?? item.price;
  const rarity = item.id.includes("legend") ? "legendary" : item.id.includes("diamond") ? "epic" : item.kind === "background" ? "rare" : "common";
  const bg = RARITY_BG[rarity];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative rounded-xl border p-3 transition-all ${bg} ${owned ? "opacity-80" : "hover:scale-[1.02] hover:shadow-xl"}`}
    >
      {owned && <div className="absolute top-2 right-2 bg-green-500 rounded-full p-0.5"><Check className="w-3 h-3 text-white" /></div>}
      {deal && !owned && <div className="absolute top-2 left-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">-{deal.discountPct}%</div>}
      <div className="text-4xl text-center mb-2">{item.glyph}</div>
      <div className="text-center">
        <p className="text-white font-bold text-sm truncate">{item.label}</p>
        <div className="flex items-center justify-center gap-1 mt-1 text-amber-300 text-sm font-black">
          <Coins className="w-3 h-3" />
          {deal && !owned && <span className="line-through text-white/30 mr-1 text-xs">{original}</span>}
          <span>{price}</span>
        </div>
        {!owned && (
          <Button onClick={onBuy} disabled={purchasing} className="w-full mt-2 py-1 text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold">
            {purchasing ? "..." : "COMPRAR"}
          </Button>
        )}
        {owned && !equipped && (
          <Button onClick={onEquip} disabled={equipping} variant="outline" className="w-full mt-2 py-1 text-xs border-white/20 text-white/80">
            {equipping ? "..." : "EQUIPAR"}
          </Button>
        )}
        {equipped && <div className="w-full mt-2 py-1 text-xs text-center text-yellow-400 font-bold"><Sparkles className="inline w-3 h-3 mr-1" />EQUIPADO</div>}
      </div>
    </motion.div>
  );
}
