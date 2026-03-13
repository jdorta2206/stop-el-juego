import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button, Card } from "@/components/ui";
import { Play, Users, Trophy, Share2, MessageCircle, Facebook, Instagram, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { shareText } from "@/lib/utils";
import { PremiumModal } from "@/components/PremiumModal";
import { usePremium } from "@/lib/usePremium";
import { usePlayer } from "@/hooks/use-player";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

export default function Home() {
  const { player } = usePlayer();
  const { isPremium } = usePremium(player?.id);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Handle return from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("premium") === "success") {
      window.history.replaceState({}, "", window.location.pathname);
      setShowPremiumModal(true);
    }
  }, []);

  const share = shareText(
    "¡Juega a STOP conmigo! El clásico juego de palabras. ¿Quién es más rápido?",
    window.location.origin
  );

  const handleNativeShare = () => share.native();

  return (
    <Layout>
      {showPremiumModal && (
        <PremiumModal
          open={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          playerId={player?.id || "guest"}
          playerName={player?.name || "Jugador"}
          isPremium={isPremium}
        />
      )}

      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full space-y-7 py-6">

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", bounce: 0.55, duration: 0.9 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.img
            src={LOGO_URL}
            alt="STOP"
            className="w-36 h-36 md:w-44 md:h-44 rounded-full"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 0 0 4px rgba(249,168,37,0.3)" }}
            animate={{ rotate: [0, 2, -2, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white/80 font-bold text-lg text-center"
          >
            El clásico juego de palabras
          </motion.p>
        </motion.div>

        {/* Main buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="w-full space-y-3"
        >
          {/* Play vs AI — main CTA */}
          <Link href="/solo">
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-2xl tracking-wide shadow-xl"
              style={{
                background: "linear-gradient(135deg, #1a237e, #283593)",
                color: "white",
                boxShadow: "0 6px 28px rgba(26,35,126,0.5)",
                fontFamily: "'Baloo 2', sans-serif",
              }}
            >
              <Play className="w-6 h-6 fill-white" />
              JUGAR VS IA
            </motion.div>
          </Link>

          {/* Premium button */}
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowPremiumModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-base tracking-wide shadow-lg"
            style={
              isPremium
                ? { background: "rgba(249,168,37,0.18)", border: "2px solid rgba(249,168,37,0.5)", color: "#f9a825" }
                : { background: "rgba(249,168,37,0.12)", border: "2px solid rgba(249,168,37,0.3)", color: "#f9a825" }
            }
          >
            <Crown className="w-5 h-5" />
            {isPremium ? "⭐ Premium activo" : "Activar Premium — sin anuncios"}
          </motion.button>

          {/* Multiplayer + Ranking */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/multiplayer">
              <motion.div
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="flex flex-col items-center gap-2 py-5 rounded-2xl font-bold shadow-lg cursor-pointer"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "2px solid rgba(255,255,255,0.15)",
                  color: "white",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Users className="w-8 h-8 text-[#f9a825]" />
                <span className="text-sm font-black">Multijugador</span>
              </motion.div>
            </Link>

            <Link href="/ranking">
              <motion.div
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="flex flex-col items-center gap-2 py-5 rounded-2xl font-bold shadow-lg cursor-pointer"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "2px solid rgba(255,255,255,0.15)",
                  color: "white",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Trophy className="w-8 h-8 text-[#f9a825]" />
                <span className="text-sm font-black">Ranking</span>
              </motion.div>
            </Link>
          </div>
        </motion.div>

        {/* Share row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-3"
        >
          <span className="text-white/50 text-sm font-bold">Invita amigos:</span>

          {/* WhatsApp */}
          <a
            href={share.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            <motion.div
              whileHover={{ scale: 1.15, y: -2 }}
              whileTap={{ scale: 0.92 }}
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
              style={{ background: "#25D366" }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </motion.div>
          </a>

          {/* Facebook */}
          <a href={share.facebook} target="_blank" rel="noopener noreferrer">
            <motion.div
              whileHover={{ scale: 1.15, y: -2 }}
              whileTap={{ scale: 0.92 }}
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
              style={{ background: "#1877F2" }}
            >
              <Facebook className="w-5 h-5 text-white fill-white" />
            </motion.div>
          </a>

          {/* Instagram */}
          <a href={share.instagram} target="_blank" rel="noopener noreferrer">
            <motion.div
              whileHover={{ scale: 1.15, y: -2 }}
              whileTap={{ scale: 0.92 }}
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
              style={{
                background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
              }}
            >
              <Instagram className="w-5 h-5 text-white" />
            </motion.div>
          </a>

          {/* Native share */}
          <motion.button
            whileHover={{ scale: 1.15, y: -2 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleNativeShare}
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <Share2 className="w-5 h-5 text-white" />
          </motion.button>
        </motion.div>
      </div>
    </Layout>
  );
}
