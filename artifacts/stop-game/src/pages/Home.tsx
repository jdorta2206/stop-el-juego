import { usePlayer } from "@/hooks/use-player";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Gamepad2, Trophy, Users, Star, Sparkles, ArrowRight, Calendar, Clock } from "lucide-react";

export default function Home() {
  const { player } = usePlayer();
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <div className="flex flex-col items-center gap-8 py-6 px-4 max-w-4xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-5xl md:text-7xl font-black tracking-tight">
            <span className="text-white">STOP</span>
            <br />
            <span className="text-secondary">El Juego de Palabras</span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Demuestra tu rapidez mental y vocabulario en el clásico juego de categorías.
            Juega solo, con amigos o contra el mundo.
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            {player ? (
              <Button
                onClick={() => setLocation("/jugar")}
                className="bg-secondary text-black font-bold px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-secondary/30 transition-all"
              >
                <Gamepad2 className="w-5 h-5 mr-2" />
                Jugar ahora
              </Button>
            ) : (
              <Button
                onClick={() => setLocation("/login")}
                className="bg-secondary text-black font-bold px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-secondary/30 transition-all"
              >
                <Users className="w-5 h-5 mr-2" />
                Iniciar sesión
              </Button>
            )}
            <Button
              onClick={() => setLocation("/como-jugar")}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cómo jugar
            </Button>
          </div>
        </motion.div>

        {/* ============================================================ */}
        {/* BANNER DEL RETO DIARIO (COMO ESTABA ANTES)                   */}
        {/* ============================================================ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-2xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-2xl p-5 border border-yellow-500/30 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/20 p-3 rounded-xl">
              <Calendar className="w-8 h-8 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Reto del día</h3>
              <p className="text-white/60 text-sm">Una letra, todos compiten</p>
            </div>
          </div>
          <Button
            onClick={() => setLocation("/reto")}
            className="bg-yellow-500 text-black font-bold px-6 py-2 rounded-xl hover:bg-yellow-400 transition-colors"
          >
            Jugar reto →
          </Button>
        </motion.div>

        {/* ============================================================ */}
        {/* ESTADÍSTICAS RÁPIDAS (PARTIDAS, RACHA, ETC.)                */}
        {/* ============================================================ */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
            <p className="text-2xl font-black text-white">35</p>
            <p className="text-xs text-white/50">días</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
            <p className="text-2xl font-black text-yellow-400">14</p>
            <p className="text-xs text-white/50">nivel</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
            <p className="text-2xl font-black text-green-400">8.7k</p>
            <p className="text-xs text-white/50">XP</p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODOS DE JUEGO (IGUAL QUE ANTES)                             */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl">
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setLocation("/solo")}>
            <Gamepad2 className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-white font-bold">Solo</p>
            <p className="text-xs text-white/50">Vs IA</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setLocation("/multiplayer")}>
            <Users className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-white font-bold">Multijugador</p>
            <p className="text-xs text-white/50">En tiempo real</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setLocation("/reto")}>
            <Star className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-white font-bold">Reto diario</p>
            <p className="text-xs text-white/50">Nuevo cada día</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setLocation("/ranking")}>
            <Trophy className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-white font-bold">Ranking</p>
            <p className="text-xs text-white/50">Global</p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CONTENIDO DE VALOR PARA ADSENSE (abajo del todo, no molesta) */}
        {/* ============================================================ */}
        <div className="w-full mt-8 pt-6 border-t border-white/10">
          <div className="text-center">
            <p className="text-white/40 text-xs max-w-xl mx-auto">
              STOP es un juego de palabras gratuito donde compites por letras y categorías.
              Mejora tu vocabulario y diviértete con amigos. Conoce más en nuestro{' '}
              <a href="/blog" className="text-secondary hover:underline">blog</a>.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
