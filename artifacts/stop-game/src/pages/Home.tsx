import { usePlayer } from "@/hooks/use-player";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Gamepad2, Trophy, Users, Star, Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  const { player } = usePlayer();
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <div className="flex flex-col items-center gap-6 py-6 px-4 max-w-4xl mx-auto">
        {/* Hero (exactamente como estaba antes) */}
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

        {/* Modos de juego (exactamente como estaba antes) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl">
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
            <Gamepad2 className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-white font-bold">Solo</p>
            <p className="text-xs text-white/50">Vs IA</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
            <Users className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-white font-bold">Multijugador</p>
            <p className="text-xs text-white/50">En tiempo real</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
            <Star className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-white font-bold">Reto diario</p>
            <p className="text-xs text-white/50">Nuevo cada día</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
            <Trophy className="w-8 h-8 text-secondary mx-auto mb-2" />
            <p className="text-white font-bold">Ranking</p>
            <p className="text-xs text-white/50">Global</p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CONTENIDO DE VALOR PARA ADSENSE (al final, visible pero sin molestar) */}
        {/* ============================================================ */}
        <div className="w-full mt-12 border-t border-white/10 pt-8">
          <h2 className="text-2xl font-black text-white text-center mb-6">¿Qué es STOP?</h2>
          <div className="text-white/70 text-sm leading-relaxed space-y-3 max-w-3xl mx-auto">
            <p>
              STOP es un juego de palabras multijugador inspirado en el clásico Tutti Frutti o Scattergories. 
              Los jugadores compiten para encontrar palabras que empiecen por una letra aleatoria y que 
              encajen en categorías como Nombre, Lugar, Animal, Objeto, Color, Fruta y Marca.
            </p>
            <p>
              El juego está disponible en español, inglés, portugués y francés, y se puede jugar en modo 
              solo contra la IA, en partidas multijugador en tiempo real, o en retos diarios.
            </p>
            <p>
              Cada partida es una carrera contrarreloj: tienes 60 segundos para escribir una palabra por 
              cada categoría. Las respuestas originales suman 10 puntos, y el jugador con más puntos al 
              final de las rondas gana la partida.
            </p>
            <p>
              STOP no solo es entretenido, sino que también ayuda a mejorar el vocabulario, la rapidez 
              mental y la capacidad de concentración. Es ideal para jugar en familia, con amigos o en 
              eventos escolares.
            </p>
          </div>
          <div className="text-center mt-6">
            <a href="/blog" className="text-secondary hover:underline text-sm font-bold">
              📚 Leer más en nuestro blog
            </a>
          </div>
        </div>

        {/* CTA final (opcional) */}
        <div className="w-full text-center py-4">
          <Button
            onClick={() => setLocation(player ? "/jugar" : "/login")}
            className="bg-secondary text-black font-bold px-8 py-4 text-base rounded-xl shadow-lg hover:shadow-secondary/30 transition-all"
          >
            {player ? "Jugar ahora" : "Iniciar sesión y jugar"}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </Layout>
  );
}
