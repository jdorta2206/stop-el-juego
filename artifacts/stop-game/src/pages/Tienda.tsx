import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingBag, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { usePlayer } from "@/hooks/use-player";
import { useInventory } from "@/hooks/useInventory";
import { CosmeticShop } from "@/components/CosmeticShop";

export default function Tienda() {
  const { player: me, isLoaded } = usePlayer();
  const { inventory, refresh, buy, equip } = useInventory(me?.id);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto w-full px-4 pb-28 pt-2 space-y-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm font-bold transition-colors">
          <ArrowLeft size={16} /> Inicio
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden p-5 rounded-3xl border border-white/10"
          style={{ background: "linear-gradient(135deg, rgba(249,168,37,0.18), rgba(220,38,38,0.12))" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 shrink-0">
              <ShoppingBag className="w-6 h-6 text-amber-300" />
            </span>
            <div>
              <h1 className="font-display font-black text-2xl leading-tight">Tienda</h1>
              <p className="text-sm text-white/60 leading-snug">
                Avatares, marcos y fondos para personalizar tu perfil.
              </p>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-white/70 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            Gana monedas jugando y desbloquea cosméticos exclusivos.
          </p>
        </motion.div>

        {!isLoaded ? (
          <div className="text-center py-16 text-white/40 text-sm">Cargando…</div>
        ) : !me?.id ? (
          <div className="text-center py-16 px-6 rounded-3xl border border-white/10 bg-black/30 space-y-3">
            <p className="text-4xl">🛍️</p>
            <p className="font-bold text-white/80">Crea tu perfil para abrir la tienda</p>
            <p className="text-sm text-white/50">Juega una partida para empezar a ganar monedas y comprar cosméticos.</p>
            <Link
              href="/"
              className="inline-block mt-1 px-5 py-2.5 rounded-xl font-black text-sm bg-amber-400/20 border border-amber-400/50 text-amber-300 hover:bg-amber-400/30 transition-colors"
            >
              Empezar a jugar
            </Link>
          </div>
        ) : !inventory ? (
          <div className="text-center py-16 text-white/40 text-sm">Cargando tienda…</div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="p-4 rounded-2xl border border-white/10 bg-black/30"
          >
            <CosmeticShop
              playerId={me.id}
              inventory={inventory}
              refresh={refresh}
              buy={buy}
              equip={equip}
            />
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
