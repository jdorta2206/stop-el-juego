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
      <div className="flex flex-col items-center gap-8 py-8 px-4 max-w-4xl mx-auto">
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

        {/* Modos de juego (iconos rápidos) */}
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
        {/* SECCIONES DE TEXTO PARA ADSENSE (contenido de valor)          */}
        {/* ============================================================ */}

        <div className="w-full space-y-12 mt-8 text-left">

          {/* Sección 1: Qué es STOP */}
          <section>
            <h2 className="text-3xl font-black text-white mb-4">¿Qué es STOP?</h2>
            <div className="text-white/80 leading-relaxed space-y-3">
              <p>
                <strong>STOP</strong> es un juego de palabras multijugador inspirado en el clásico 
                <em> Tutti Frutti</em> o <em>Scattergories</em>. Los jugadores compiten para encontrar 
                palabras que empiecen por una letra aleatoria y que encajen en categorías como 
                <strong>Nombre</strong>, <strong>Lugar</strong>, <strong>Animal</strong>, 
                <strong>Objeto</strong>, <strong>Color</strong>, <strong>Fruta</strong> y 
                <strong>Marca</strong>.
              </p>
              <p>
                El juego está disponible en <strong>español, inglés, portugués y francés</strong>, 
                y se puede jugar en modo <strong>solo contra la IA</strong>, en 
                <strong>partidas multijugador en tiempo real</strong> con amigos o jugadores de todo 
                el mundo, o en <strong>retos diarios</strong> que ponen a prueba tu agilidad mental.
              </p>
              <p>
                Cada partida es una carrera contrarreloj: tienes un tiempo limitado para escribir 
                una palabra por cada categoría que empiece por la letra sorteada. Las respuestas 
                originales suman puntos, y el jugador con más puntos al final de las rondas gana la 
                partida. ¡Pero cuidado! Puedes usar <strong>power-ups</strong>, espiar a tus rivales 
                y votar por las mejores jugadas para hacer la experiencia más dinámica y divertida.
              </p>
              <p>
                STOP no solo es un juego de entretenimiento, sino también una herramienta para 
                <strong>ampliar tu vocabulario, mejorar tu rapidez mental y aprender nuevas palabras</strong> 
                en varios idiomas. Es ideal para jugar en familia, con amigos o en eventos escolares.
              </p>
            </div>
          </section>

          {/* Sección 2: Cómo jugar */}
          <section>
            <h2 className="text-3xl font-black text-white mb-4">Cómo jugar a STOP</h2>
            <div className="text-white/80 leading-relaxed space-y-3">
              <p>
                <strong>Paso 1:</strong> Elige un modo de juego: 
                <strong> Solo</strong> (contra la IA), <strong>Multijugador</strong> (en tiempo real 
                con otros jugadores), <strong>Reto Diario</strong> (una partida única con puntuación 
                global) o <strong>Blitz</strong> (partidas rápidas de 30 segundos).
              </p>
              <p>
                <strong>Paso 2:</strong> Se genera una letra aleatoria (de la A a la Z, excepto Q y X). 
                Todos los jugadores deben escribir una palabra que empiece por esa letra para cada 
                una de las categorías de la partida.
              </p>
              <p>
                <strong>Paso 3:</strong> Tienes un tiempo limitado (60 segundos por ronda, o 30 
                segundos en modo Blitz) para completar todas las categorías. Cuanto más rápido 
                termines, mejor.
              </p>
              <p>
                <strong>Paso 4:</strong> Las palabras se puntúan automáticamente: cada respuesta 
                válida y original suma <strong>10 puntos</strong>. Las respuestas repetidas o 
                incorrectas no suman puntos.
              </p>
              <p>
                <strong>Paso 5:</strong> El jugador que más puntos acumule después de todas las 
                rondas (normalmente 3 o 5 rondas) es el ganador. En caso de empate, el que haya 
                sido el "Stopper" (el que detuvo la ronda) tiene ventaja.
              </p>
              <p>
                <strong>Paso 6:</strong> ¡Personaliza tu perfil con <strong>cosméticos exclusivos</strong> 
                (avatares, marcos, fondos) que puedes comprar con monedas ganadas en partidas o con 
                el Pack Mundial, y presume de tu estilo en el ranking global.
              </p>
            </div>
          </section>

          {/* Sección 3: Estrategias para ganar */}
          <section>
            <h2 className="text-3xl font-black text-white mb-4">Estrategias para ganar</h2>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>
                <strong>Prioriza palabras comunes pero válidas</strong> para asegurar puntos 
                rápidamente, especialmente en las primeras rondas.
              </li>
              <li>
                <strong>Usa el espía</strong> para ver las respuestas de tus rivales y adaptar tu 
                estrategia sobre la marcha. Cada jugador tiene un número limitado de usos por ronda.
              </li>
              <li>
                <strong>Aprovecha el poder de "STOP"</strong>: si completas todas las categorías antes 
                de que termine el tiempo, puedes detener la ronda y ganar una bonificación de +5 puntos.
              </li>
              <li>
                <strong>Personaliza tu perfil</strong> con cosméticos para destacar en el ranking y 
                motivar a otros jugadores a desafiarte.
              </li>
              <li>
                <strong>Juega a diario</strong> para mantener tu racha de partidas ganadas y acumular 
                monedas extra, que te permitirán comprar más cosméticos y mejorar tu experiencia.
              </li>
              <li>
                <strong>Participa en el Reto Diario</strong> para competir contra todos los jugadores 
                y ganar premios exclusivos.
              </li>
              <li>
                <strong>Conoce bien las categorías</strong> y practica con diferentes letras para 
                ampliar tu vocabulario y ser más rápido en cada ronda.
              </li>
            </ul>
          </section>

          {/* Sección 4: Últimos artículos del blog */}
          <section>
            <h2 className="text-3xl font-black text-white mb-4">Últimos artículos del blog</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <a
                href="/blog/como-jugar-stop"
                className="bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
              >
                <h3 className="text-white font-bold">Cómo jugar STOP: guía completa</h3>
                <p className="text-white/50 text-sm">Aprende todas las reglas y modos de juego.</p>
              </a>
              <a
                href="/blog/estrategias-avanzadas"
                className="bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
              >
                <h3 className="text-white font-bold">Estrategias avanzadas</h3>
                <p className="text-white/50 text-sm">Domina el juego con estos consejos de expertos.</p>
              </a>
              <a
                href="/blog/mejores-palabras"
                className="bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
              >
                <h3 className="text-white font-bold">Las mejores palabras por letra</h3>
                <p className="text-white/50 text-sm">Amplía tu vocabulario para ganar siempre.</p>
              </a>
            </div>
          </section>

        </div>

        {/* CTA final */}
        <div className="w-full text-center py-8">
          <Button
            onClick={() => setLocation(player ? "/jugar" : "/login")}
            className="bg-secondary text-black font-bold px-10 py-6 text-lg rounded-xl shadow-lg hover:shadow-secondary/30 transition-all"
          >
            {player ? "Jugar ahora" : "Iniciar sesión y jugar"}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </Layout>
  );
}
