import { useState } from "react";
import { usePlayer } from "@/hooks/use-player";
import { useInventory } from "@/hooks/useInventory";
import { Layout } from "@/components/Layout";
import { CosmeticShop } from "@/components/CosmeticShop";
import { Button } from "@/components/ui";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ShoppingBag, Crown, Sparkles, Gift } from "lucide-react";

export default function Tienda() {
  const { player } = usePlayer();
  const { inventory, refresh, buy, equip } = useInventory(player?.id || null);
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
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Título y monedas */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-secondary" />
            Tienda
          </h1>
          <div className="flex items-center gap-2 bg-amber-400/15 px-4 py-2 rounded-full border border-amber-400/40">
            <span className="text-amber-400 font-black text-sm">
              🪙 {inventory.coins}
            </span>
          </div>
        </div>

        {/* Pack Mundial - BANNER DESTACADO (con la lógica correcta) */}
        <div className="mb-8">
          <CosmeticShop />
        </div>

        {/* El resto de la tienda (cosméticos con monedas) */}
        <div className="mt-6">
          <CosmeticShop showInventory={true} />
        </div>

        {/* Botón Premium (opcional) */}
        <div className="mt-8 text-center">
          <Button
            onClick={() => setShowPremiumModal(true)}
            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold px-6 py-3 rounded-xl shadow-lg"
          >
            <Crown className="w-5 h-5 mr-2" />
            Hacerse Premium
          </Button>
        </div>
      </div>
    </Layout>
  );
}
