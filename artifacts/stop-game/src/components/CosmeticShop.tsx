import { useState, useCallback } from "react";
import { usePlayer } from "@/hooks/use-player";
import { useInventory } from "@/hooks/useInventory";
import { Button } from "@/components/ui";
import { toast } from "sonner";
import { Check, Crown, Sparkles, Gift, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePaymentChannel } from "@/hooks/usePaymentChannel";
import { purchaseWorldCupPackOnPlay, isPlayPurchaseCancelled } from "@/lib/playBilling";
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
  { id: "avatar_wc_ball", name: "Balón Mundial", description: "Avatar del balón oficial", price: 0, type: "avatar", rarity: "epic", icon: "⚽" },
  { id: "avatar_wc_jersey", name: "Camiseta Mundial", description: "Avatar de la camiseta", price: 0, type: "avatar", rarity: "epic", icon: "👕" },
  { id: "avatar_wc_goal", name: "Gol", description: "Avatar celebrando gol", price: 0, type: "avatar", rarity: "epic", icon: "🥅" },
  { id: "avatar_wc_gloves", name: "Guantes de Portero", description: "Avatar de guantes", price: 0, type: "avatar", rarity: "rare", icon: "🧤" },
  { id: "avatar_wc_boots", name: "Botines", description: "Avatar de botines", price: 0, type: "avatar", rarity: "rare", icon: "👟" },
  { id: "avatar_wc_medal", name: "Medalla", description: "Avatar de medalla", price: 0, type: "avatar", rarity: "epic", icon: "🥇" },
  { id: "avatar_wc_trophy", name: "Trofeo", description: "Avatar del trofeo", price: 0, type: "avatar", rarity: "legendary", icon: "🏆" },
  { id: "avatar_wc_flag_es", name: "Bandera España", description: "Avatar bandera de España", price: 0, type: "avatar", rarity: "rare", icon: "🇪🇸" },
  { id: "avatar_wc_flag_br", name: "Bandera Brasil", description: "Avatar bandera de Brasil", price: 0, type: "avatar", rarity: "rare", icon: "🇧🇷" },
  { id: "avatar_wc_flag_ar", name: "Bandera Argentina", description: "Avatar bandera de Argentina", price: 0, type: "avatar", rarity: "rare", icon: "🇦🇷" },
  { id: "avatar_wc_flag_fr", name: "Bandera Francia", description: "Avatar bandera de Francia", price: 0, type: "avatar", rarity: "rare", icon: "🇫🇷" },
  { id: "avatar_wc_flag_de", name: "Bandera Alemania", description: "Avatar bandera de Alemania", price: 0, type: "avatar", rarity: "rare", icon: "🇩🇪" },
  { id: "avatar_wc_flag_pt", name: "Bandera Portugal", description: "Avatar bandera de Portugal", price: 0, type: "avatar", rarity: "rare", icon: "🇵🇹" },
  { id: "avatar_wc_flag_it", name: "Bandera Italia", description: "Avatar bandera de Italia", price: 0, type: "avatar", rarity: "rare", icon: "🇮🇹" },
  { id: "avatar_wc_flag_nl", name: "Bandera Países Bajos", description: "Avatar bandera de Países Bajos", price: 0, type: "avatar", rarity: "rare", icon: "🇳🇱" },
  { id: "avatar_wc_flag_mx", name: "Bandera México", description: "Avatar bandera de México", price: 0, type: "avatar", rarity: "rare", icon: "🇲🇽" },
  { id: "avatar_wc_flag_us", name: "Bandera USA", description: "Avatar bandera de USA", price: 0, type: "avatar", rarity: "rare", icon: "🇺🇸" },
  { id: "avatar_wc_flag_uy", name: "Bandera Uruguay", description: "Avatar bandera de Uruguay", price: 0, type: "avatar", rarity: "rare", icon: "🇺🇾" },
  { id: "avatar_wc_flag_co", name: "Bandera Colombia", description: "Avatar bandera de Colombia", price: 0, type: "avatar", rarity: "rare", icon: "🇨🇴" },
  { id: "avatar_wc_flag_jp", name: "Bandera Japón", description: "Avatar bandera de Japón", price: 0, type: "avatar", rarity: "rare", icon: "🇯🇵" },
  { id: "frame_wc_cesped", name: "Marco Césped", description: "Marco de césped mundialista", price: 0, type: "frame", rarity: "epic", icon: "🌿" },
  { id: "frame_wc_espana", name: "Marco España", description: "Marco de la selección española", price: 0, type: "frame", rarity: "legendary", icon: "🇪🇸" },
  { id: "frame_wc_copa", name: "Marco Copa Mundial", description: "Marco del trofeo", price: 0, type: "frame", rarity: "legendary", icon: "🏆" },
  { id: "bg_wc_cesped", name: "Fondo Césped", description: "Fondo de césped", price: 0, type: "background", rarity: "epic", icon: "🌿" },
  { id: "bg_wc_noche", name: "Fondo Noche de Final", description: "Fondo de la final", price: 0, type: "background", rarity: "legendary", icon: "🌙" },
  { id: "bg_wc_espana", name: "Fondo España", description: "Fondo de la selección", price: 0, type: "background", rarity: "legendary", icon: "🇪🇸" },
  { id: "bg_wc_copa", name: "Fondo Copa Mundial", description: "Fondo del trofeo", price: 0, type: "background", rarity: "legendary", icon: "🏆" },
];

export function CosmeticShop() {
  const { player } = usePlayer();
  const { inventory, refresh: refreshInventory, buy, equip } = useInventory(player?.id || null);
  const [selectedCategory, setSelectedCategory] = useState<"all" | "avatar" | "frame" | "background">("all");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [showPackModal, setShowPackModal] = useState(false);
  // 🔥 Usamos el mismo hook que PremiumModal para detectar el canal
  const { channel } = usePaymentChannel();

  const hasWorldCupPack = inventory?.items?.some(item => 
    WORLD_CUP_COSMETICS.some(c => c.id === item.id)
  ) ?? false;

  // ============================================================
  // handleBuyPack – Usa el canal de pago detectado por usePaymentChannel
  // ============================================================
  const handleBuyPack = useCallback(async () => {
    if (channel === "loading") return;
    setPurchasing("pack_mundial");

    try {
      // ✅ Si el canal es "play", usamos Google Play Billing
      if (channel === "play") {
        const result = await purchaseWorldCupPackOnPlay();
        if (result.granted) {
          await refreshInventory();
          celebrateReward();
          window.alert("¡Pack Mundial desbloqueado! Ya tienes todos los cosméticos del Mundial. ⚽");
          setPurchasing(null);
          return;
        }
        // Si falla (ej: usuario cancela), no hacemos nada más
        setPurchasing(null);
        return;
      }

      // 🌐 En cualquier otro caso (web, escritorio, etc.) usamos Stripe
      const { url } = await startPackCheckout({ playerId: player?.id || "" });
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No se recibió URL de Stripe");
      }
    } catch (error: any) {
      if (isPlayPurchaseCancelled(error)) {
        setPurchasing(null);
        return;
      }
      console.error("Error al comprar Pack Mundial:", error);
      window.alert(error instanceof Error ? error.message : "No se pudo completar la compra");
    } finally {
      setPurchasing(null);
    }
  }, [channel, player?.id, refreshInventory]);

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
      {/* Banner Pack Mundial */}
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
              <Button
                onClick={handleBuyPack}
                disabled={purchasing === "pack_mundial" || channel === "loading"}
                className="bg-white text-black hover:bg-white/90 font-bold px-8 py-6 text-lg rounded-xl shadow-lg"
              >
                {purchasing === "pack_mundial" ? (
                  "Procesando..."
                ) : (
                  <>
                    <Crown className="w-5 h-5 mr-2 text-yellow-500" />
                    {WORLD_CUP_PACK_PRICE_LABEL}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Categorías */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: "all", label: "Todos", icon: "🎨" },
          { id: "avatar", label: "Avatares", icon: "👤" },
          { id: "frame", label: "Marcos", icon: "🖼️" },
          { id: "background", label: "Fondos", icon: "🎨" },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id as any)}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              selectedCategory === cat.id
                ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid de cosméticos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filteredCosmetics.map((item) => {
          const owned = isOwned(item.id);
          const equipped = isEquipped(item.id);
          const rarityBg = RARITY_BG[item.rarity];

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`relative rounded-xl border p-3 transition-all ${rarityBg} ${
                owned ? "opacity-80" : "hover:scale-105 hover:shadow-xl"
              }`}
            >
              {owned && (
                <div className="absolute top-2 right-2 bg-green-500 rounded-full p-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              {equipped && (
                <div className="absolute top-2 left-2 bg-yellow-500 rounded-full p-0.5">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="text-4xl text-center mb-2">{item.icon}</div>
              <div className="text-center">
                <p className="text-white font-bold text-sm truncate">{item.name}</p>
                <p className="text-white/40 text-xs truncate">{item.description}</p>
                {item.price > 0 && !owned && (
                  <div className="flex items-center justify-center gap-1 mt-2 text-yellow-400 text-sm font-bold">
                    <Coins className="w-3 h-3" />
                    {item.price}
                  </div>
                )}
                {!owned && item.price === 0 && (
                  <div className="flex items-center justify-center gap-1 mt-2 text-green-400 text-xs">
                    <Gift className="w-3 h-3" />
                    Pack exclusivo
                  </div>
                )}
                {!owned && item.price > 0 && (
                  <Button
                    onClick={() => handleBuy(item)}
                    disabled={purchasing === item.id}
                    className="w-full mt-2 py-1 text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold"
                  >
                    {purchasing === item.id ? "..." : "COMPRAR"}
                  </Button>
                )}
                {owned && !equipped && (
                  <Button
                    onClick={() => handleEquip(item.type, item.id)}
                    disabled={equipping === `${item.type}:${item.id}`}
                    variant="outline"
                    className="w-full mt-2 py-1 text-xs border-white/20 text-white/80"
                  >
                    {equipping === `${item.type}:${item.id}` ? "..." : "EQUIPAR"}
                  </Button>
                )}
                {equipped && (
                  <div className="w-full mt-2 py-1 text-xs text-center text-yellow-400 font-bold">
                    EQUIPADO
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modal de confirmación */}
      <AnimatePresence>
        {showPackModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPackModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 max-w-md w-full border border-yellow-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="text-6xl mb-4">🌍</div>
                <h3 className="text-2xl font-black text-white mb-2">Pack Mundial</h3>
                <p className="text-white/70 mb-4">
                  Adquiere 27 cosméticos exclusivos del Mundial por solo <span className="text-yellow-400 font-bold">2,99 €</span>
                </p>
                <div className="space-y-2 mb-6 text-left">
                  <p className="text-white/80 text-sm flex items-center gap-2">⚽ 20 avatares de banderas y fútbol</p>
                  <p className="text-white/80 text-sm flex items-center gap-2">🖼️ 3 marcos temáticos</p>
                  <p className="text-white/80 text-sm flex items-center gap-2">🎨 4 fondos exclusivos</p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setShowPackModal(false)} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleBuyPack} className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold">
                    Comprar por 2,99 €
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}