import { useState } from "react";
import { usePlayer } from "@/hooks/use-player";
import { useInventory } from "@/hooks/useInventory";
import { Layout } from "@/components/Layout";
import { CosmeticShop } from "@/components/CosmeticShop";
import { Button } from "@/components/ui";
import { useLocation } from "wouter";
import { ShoppingBag, Crown } from "lucide-react";

export default function Tienda() {
  const { player } = usePlayer();
  const { inventory } = useInventory(player?.id || null);
  const [, setLocation] = useLocation();
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  if (!player || !inventory) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-white/40">Cargando tienda...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 py-3 sm:py-5">
        <div className="flex items-center justify-between mb-3 sm:mb-5 gap-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 text-secondary" />
            Tienda
          </h1>
          <div className="flex items-center gap-1 sm:gap-2 bg-amber-400/15 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-amber-400/40 shrink-0">
            <span className="text-amber-400 font-black text-xs sm:text-sm">
              🪙 {inventory.coins}
            </span>
          </div>
        </div>

        {/* La tienda se muestra una sola vez. Antes se renderizaba dos veces y duplicaba su altura en móvil. */}
        <div className="w-full">
          <CosmeticShop />
        </div>

        <div className="mt-4 sm:mt-6 text-center">
          <Button
            onClick={() => setShowPremiumModal(true)}
            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl shadow-lg text-sm sm:text-base"
          >
            <Crown className="w-5 h-5 mr-2" />
            Hacerse Premium
          </Button>
        </div>
      </div>
    </Layout>
  );
}
