import { useState, useCallback } from "react";
import { usePlayer } from "@/hooks/use-player";
import { useInventory } from "@/hooks/useInventory";
import { Button } from "@/components/ui";
import { toast } from "sonner";
import { Check, Crown, Sparkles, Gift, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { purchaseWorldCupPackOnPlay } from "@/lib/playBilling";
import { startPackCheckout, WORLD_CUP_PACK_PRICE_LABEL } from "@/lib/worldCupPack";
import { celebrateReward } from "@/lib/celebrate";

interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: "avatar" | "frame" | "title" | "background";
  rarity: "common" | "rare" | "epic" | "legendary";
  icon: string;
  owned?: boolean;
  equipped?: boolean;
}

const RARITY_COLORS = {
  common: "from-gray-400 to-gray-600",
  rare: "from-blue-400 to-blue-600",
  epic: "from-purple-400 to-purple-600",
  legendary: "from-yellow-400 to-orange-500",
};

const RARITY_BG = {
  common: "bg-gray-500/20 border-gray-500/30",
  rare: "bg-blue-500/20 border-blue-500/30",
  epic: "bg-purple-500/20 border-purple-500/30",
  legendary: "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30",
};

const WORLD_CUP_COSMETICS: CosmeticItem[] = [
  // ... (la lista completa de 27 cosméticos, igual que antes)
];

export function CosmeticShop() {
  const { player } = usePlayer();
  const { inventory, refresh: refreshInventory, buy, equip } = useInventory(player?.id || null);
  const [selectedCategory, setSelectedCategory] = useState<"all" | "avatar" | "frame" | "background">("all");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [showPackModal, setShowPackModal] = useState(false);

  const hasWorldCupPack = inventory?.items?.some(item => 
    WORLD_CUP_COSMETICS.some(c => c.id === item.id)
  ) ?? false;

  // 🔍 Detectar si estamos dentro de la app de Play Store
  const isInApp = typeof window !== "undefined" &&
    typeof window.getDigitalGoodsService === "function";

  // ============================================================
  // COMPRA CON GOOGLE PLAY (solo dentro de la app)
  // ============================================================
  const handleBuyPackPlay = useCallback(async () => {
    setPurchasing("pack_mundial");
    try {
      const result = await purchaseWorldCupPackOnPlay(player?.id || "");
      if (result.granted) {
        await refreshInventory();
        celebrateReward();
        window.alert("¡Pack Mundial desbloqueado! 🎉");
        setPurchasing(null);
        return;
      }
      window.alert("❌ No se pudo completar la compra con Google Play.");
    } catch (error: any) {
      if (error?.code === "PURCHASE_CANCELLED") {
        setPurchasing(null);
        return;
      }
      console.error("Error al comprar Pack Mundial:", error);
      window.alert(`❌ Error: ${error.message || "Error desconocido"}`);
    } finally {
      setPurchasing(null);
    }
  }, [player?.id, refreshInventory]);

  // ============================================================
  // COMPRA CON STRIPE (solo en web)
  // ============================================================
  const handleBuyPackStripe = useCallback(async () => {
    setPurchasing("pack_mundial");
    try {
      const { url } = await startPackCheckout({ playerId: player?.id || "" });
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No se recibió URL de Stripe");
      }
    } catch (error: any) {
      console.error("Error al comprar Pack Mundial:", error);
      window.alert(error instanceof Error ? error.message : "No se pudo completar la compra");
    } finally {
      setPurchasing(null);
    }
  }, [player?.id]);

  const handleEquip = useCallback(async (kind: any, value: string | null) => {
    setEquipping(`${kind}:${value}`);
    try {
      const result = await equip(kind, value);
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

  const handleBuy = useCallback(async (item: CosmeticItem) => {
    if (!player?.id) {
      toast.error("Debes iniciar sesión");
      return;
    }
    if (item.price <= 0) return;

    setPurchasing(item.id);
    const result = await buy(item.id, item.price);
    setPurchasing(null);

    if (result?.error) {
      toast.error(result.error);
      return;
    }
    await refreshInventory();
    toast.success(`¡${item.name} adquirido!`);
  }, [buy, player?.id, refreshInventory]);

  const filteredCosmetics = WORLD_CUP_COSMETICS.filter(item => {
    if (selectedCategory === "all") return true;
    return item.type === selectedCategory;
  });

  const isOwned = (itemId: string) => {
    return inventory?.items?.some(i => i.id === itemId) ?? false;
  };

  const isEquipped = (itemId: string) => {
    return inventory?.equipped && Object.values(inventory.equipped).includes(itemId);
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 p-6 shadow-2xl">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-6xl">🌍</div>
            <div>
              <h3 className="text-2xl font-black text-white">Pack Mundial</h3>
              <p className="text-white/80 text-sm">27 cosméticos exclusivos del Mundial</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-black/30 px-2 py-0.5 rounded text-xs text-white">🌱 20 avatares</span>
                <span className="bg-black/30 px-2 py-0.5 rounded text-xs text-white">🖼️ 3 marcos</span>
                <span className="bg-black/30 px-2 py-0.5 rounded text-xs text-white">🎨 4 fondos</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {hasWorldCupPack ? (
              <div className="bg-green-500/20 backdrop-blur px-6 py-3 rounded-xl border border-green-400">
                <div className="flex items-center gap-2 text-green-300 font-bold">
                  <Check className="w-5 h-5" />
                  ¡Ya lo tienes!
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                {/* 🔵 Botón Google Play (SOLO dentro de la app) */}
                {isInApp && (
                  <Button
                    onClick={handleBuyPackPlay}
                    disabled={purchasing === "pack_mundial"}
                    className="bg-[#34A853] text-white hover:bg-[#2d8f47] font-bold px-8 py-6 text-lg rounded-xl shadow-lg flex items-center gap-2"
                  >
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626-2.491-2.491 2.492-2.491zM5.864 2.658L16.802 8.99l-2.302 2.302-8.636-8.634z"/>
                    </svg>
                    {purchasing === "pack_mundial" ? "Procesando..." : "Pagar con Google Play"}
                  </Button>
                )}
                {/* 🌐 Botón Stripe (SOLO en web) */}
                {!isInApp && (
                  <Button
                    onClick={handleBuyPackStripe}
                    disabled={purchasing === "pack_mundial"}
                    className="bg-white text-black hover:bg-white/90 font-bold px-8 py-6 text-lg rounded-xl shadow-lg"
                  >
                    {purchasing === "pack_mundial" ? "Procesando..." : (
                      <>
                        <Crown className="w-5 h-5 mr-2 text-yellow-500" />
                        {WORLD_CUP_PACK_PRICE_LABEL}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* El resto del componente (categorías, grid, etc.) se mantiene igual */}
      {/* ... */}
    </div>
  );
}