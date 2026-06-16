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
              <p>
                El juego fue creado por un equipo de desarrolladores apasionados por los juegos de 
                palabras y la competición sana. Nuestra misión es ofrecer una experiencia divertida 
                y educativa que conecte a jugadores de todo el mundo. Desde su lanzamiento, STOP ha 
                crecido hasta convertirse en una comunidad activa con miles de partidas jugadas cada 
                día, y seguimos añadiendo nuevas funcionalidades y modos de juego para mantener la 
                experiencia fresca y emocionante.
              </p>
              <p>
                Además, STOP es completamente gratuito para jugar, aunque ofrecemos un <strong>Pack 
                Premium</strong> y un <strong>Pack Mundial</strong> con cosméticos exclusivos que 
                permiten personalizar tu perfil y apoyar el desarrollo continuo del juego. Estos packs 
                incluyen avatares, marcos, fondos y títulos especiales que te hacen destacar en el 
                ranking global.
              </p>
              <p>
                Si te gustan los juegos de palabras, la estrategia y la competición, STOP es el juego 
                perfecto para ti. Únete a nuestra comunidad y demuestra quién es el mejor jugador de 
                palabras.
              </p>
            </div>
          </section>

          {/* Sección 2: Cómo jugar */}
          <section>
            <h2 className="text-3xl font-black text-white mb-4">Cómo jugar a STOP</h2>
            <div className="text-white/80 leading-relaxed space-y-3">
              <p>
                <strong>Paso 1: Elegir modo de juego</strong>
              </p>
              <p>
                STOP ofrece varios modos para adaptarse a todos los gustos:
              </p>
              <ul className="list-disc list-inside pl-4 space-y-1">
                <li><strong>Solo</strong>: Juega contra la IA en partidas rápidas o personalizadas. Perfecto para practicar y mejorar tu vocabulario.</li>
                <li><strong>Multijugador</strong>: Compite en tiempo real con jugadores de todo el mundo. Crea salas públicas o privadas y reta a tus amigos.</li>
                <li><strong>Reto Diario</strong>: Un desafío único cada día con una letra y categorías especiales. Compite por la mejor puntuación global.</li>
                <li><strong>Blitz</strong>: Partidas ultrarrápidas de 30 segundos por ronda. Ideal para poner a prueba tus reflejos.</li>
              </ul>
              <p>
                <strong>Paso 2: La ronda</strong>
              </p>
              <p>
                Cada ronda comienza con una letra aleatoria (de la A a la Z, excepto Q y X). Todos los 
                jugadores deben escribir una palabra que empiece por esa letra para cada una de las 
                categorías de la partida (por ejemplo: Nombre, Lugar, Animal, Objeto, Color, Fruta, 
                Marca).
              </p>
              <p>
                <strong>Paso 3: Tiempo y puntuación</strong>
              </p>
              <p>
                Tienes un tiempo limitado (60 segundos por ronda, o 30 segundos en modo Blitz) para 
                completar todas las categorías. Cuanto más rápido termines, mejor. Las palabras se 
                puntúan automáticamente: cada respuesta válida y original suma <strong>10 puntos</strong>. 
                Las respuestas repetidas o incorrectas no suman puntos.
              </p>
              <p>
                <strong>Paso 4: El poder de STOP</strong>
              </p>
              <p>
                Si completas todas las categorías antes de que termine el tiempo, puedes pulsar el 
                botón <strong>"STOP"</strong> para detener la ronda y ganar una bonificación de 
                <strong>+5 puntos</strong>. Esto te da ventaja sobre los demás jugadores.
              </p>
              <p>
                <strong>Paso 5: Final de la partida</strong>
              </p>
              <p>
                Después de varias rondas (normalmente 3 o 5), el jugador con más puntos acumulados 
                es el ganador. En caso de empate, el que haya sido el "Stopper" en la última ronda 
                tiene ventaja. Los resultados se registran en el ranking global y en tu historial 
                personal.
              </p>
              <p>
                <strong>Paso 6: Personalización y comunidad</strong>
              </p>
              <p>
                Puedes personalizar tu perfil con <strong>cosméticos exclusivos</strong> (avatares, 
                marcos, fondos) que puedes comprar con monedas ganadas en partidas o con el 
                <strong>Pack Mundial</strong>. Además, puedes seguir a otros jugadores, chatear 
                en las salas, enviar reacciones y votar por las mejores jugadas de la ronda.
              </p>
              <p>
                ¿Listo para empezar? Regístrate gratis y únete a la comunidad de STOP. ¡Te esperamos!
              </p>
            </div>
          </section>

          {/* Sección 3: Sistema de puntuación */}
          <section>
            <h2 className="text-3xl font-black text-white mb-4">Sistema de puntuación</h2>
            <div className="text-white/80 leading-relaxed space-y-3">
              <p>
                El sistema de puntuación de STOP está diseñado para ser justo y recompensar la 
                rapidez mental, la originalidad y la estrategia.
              </p>
              <p>
                <strong>Puntuación base:</strong> Cada respuesta válida y original suma 
                <strong>10 puntos</strong>. Una respuesta se considera válida si es una palabra 
                real, empieza por la letra de la ronda y encaja en la categoría correspondiente. 
                Las palabras repetidas (que ya hayan sido escritas por otro jugador en la misma 
                ronda) no suman puntos.
              </p>
              <p>
                <strong>Bonificación por STOP:</strong> Si completas todas las categorías antes 
                de que termine el tiempo y pulsas el botón "STOP", obtienes una bonificación de 
                <strong>+5 puntos</strong>. Esta bonificación se suma a tu puntuación de la ronda 
                y puede marcar la diferencia en partidas reñidas.
              </p>
              <p>
                <strong>Penalización por espionaje:</strong> Si usas el poder de "Espía" para 
                ver las respuestas de un rival, tienes una penalización de <strong>-10 puntos</strong> 
                en esa ronda. Esto añade un componente estratégico: debes decidir cuándo es 
                rentable espiar a un rival a costa de perder puntos.
              </p>
              <p>
                <strong>Puntuación en multijugador:</strong> En partidas multijugador, las 
                puntuaciones se multiplican por <strong>1.5</strong> al finalizar la partida para 
                dar más peso a las victorias en este modo. Además, los jugadores con el 
                <strong>Pack Premium</strong> obtienen un bonus de <strong>+10%</strong> de 
                experiencia en cada partida.
              </p>
              <p>
                <strong>Racha y experiencia:</strong> Cada partida jugada suma experiencia (XP) 
                que te permite subir de nivel y desbloquear recompensas. Además, si juegas varios 
                días seguidos, mantienes una racha que te otorga monedas y bonificaciones extra. 
                La racha máxima se registra en tu perfil y es visible para todos los jugadores.
              </p>
              <p>
                <strong>Monedas:</strong> Al final de cada partida, ganas monedas en función de tu 
                puntuación. Las monedas se pueden gastar en la tienda para comprar cosméticos, 
                avatares, marcos y fondos. También puedes obtener monedas participando en retos 
                diarios y eventos especiales.
              </p>
            </div>
          </section>

          {/* Sección 4: Modos de juego */}
          <section>
            <h2 className="text-3xl font-black text-white mb-4">Modos de juego</h2>
            <div className="text-white/80 leading-relaxed space-y-3">
              <p>
                STOP ofrece varios modos de juego para que cada jugador encuentre el que mejor se 
                adapte a su estilo y disponibilidad.
              </p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>
                  <strong>Solo:</strong> Ideal para practicar y mejorar tu vocabulario. Juegas 
                  contra una IA que simula a un jugador humano. Puedes elegir el número de rondas 
                  y el tiempo por ronda. Es perfecto para calentar antes de partidas multijugador.
                </li>
                <li>
                  <strong>Multijugador en tiempo real:</strong> Compite contra jugadores de todo 
                  el mundo en partidas en directo. Puedes crear una sala pública o privada e 
                  invitar a tus amigos. Las salas tienen un límite de 8 jugadores y puedes 
                  personalizar las categorías y el número de rondas. La emoción de jugar contra 
                  personas reales es incomparable.
                </li>
                <li>
                  <strong>Reto Diario:</strong> Cada día se publica un nuevo reto con una letra 
                  y un conjunto de categorías especiales. Todos los jugadores compiten por la 
                  mejor puntuación en ese reto. Al final del día, se publica un ranking con los 
                  mejores jugadores. Es una excelente manera de mantener la comunidad activa y 
                  competitiva.
                </li>
                <li>
                  <strong>Blitz:</strong> Para los que buscan acción rápida, el modo Blitz reduce 
                  el tiempo por ronda a 30 segundos. Las partidas son más cortas e intensas, y 
                  ponen a prueba tus reflejos y tu capacidad para pensar rápido bajo presión. 
                  Perfecto para partidas cortas en cualquier momento.
                </li>
                <li>
                  <strong>Modo Torneo:</strong> (Próximamente) Organiza torneos con tus amigos 
                  o con la comunidad. Los torneos constan de varias rondas eliminatorias y el 
                  ganador obtiene premios exclusivos.
                </li>
              </ul>
              <p>
                Cada modo de juego tiene sus propias reglas y bonificaciones, pero todos comparten 
                la misma base: escribir palabras originales que empiecen por una letra determinada. 
                La variedad de modos asegura que nunca te aburras y siempre tengas un nuevo desafío 
                que superar.
              </p>
            </div>
          </section>

          {/* Sección 5: Torneos y rankings */}
          <section>
            <h2 className="text-3xl font-black text-white mb-4">Torneos y rankings</h2>
            <div className="text-white/80 leading-relaxed space-y-3">
              <p>
                Los torneos y rankings son el corazón competitivo de STOP. Aquí es donde los 
                mejores jugadores demuestran su valía y se ganan el respeto de la comunidad.
              </p>
              <p>
                <strong>Ranking global:</strong> Todos los jugadores registrados aparecen en el 
                ranking global, ordenados por su puntuación total acumulada. Cada partida que 
                ganas suma puntos a tu total, y tu posición se actualiza en tiempo real. El 
                ranking global es visible para todos y es la principal referencia de quién es 
                el mejor jugador de STOP.
              </p>
              <p>
                <strong>Ranking semanal y mensual:</strong> Además del ranking global, existen 
                rankings semanales y mensuales que se reinician periódicamente. Esto da 
                oportunidad a nuevos jugadores de escalar posiciones rápidamente y competir 
                por los primeros puestos. Los ganadores de cada periodo obtienen recompensas 
                exclusivas.
              </p>
              <p>
                <strong>Ranking de amigos:</strong> Puedes seguir a otros jugadores y ver su 
                posición en el ranking de amigos. Esto fomenta la competencia sana entre 
                conocidos y añade un componente social al juego.
              </p>
              <p>
                <strong>Torneos:</strong> (Próximamente) Los torneos serán eventos especiales 
                con inscripción previa y partidas eliminatorias. Los ganadores recibirán 
                premios en monedas, cosméticos exclusivos y títulos honoríficos. Los torneos 
                serán la máxima expresión de la competición en STOP.
              </p>
              <p>
                Además, todos los rankings incluyen información detallada sobre cada jugador: 
                número de partidas jugadas, victorias, racha actual, racha máxima, nivel, 
                experiencia y cosméticos equipados. Esto permite a los jugadores conocer a 
                sus rivales y preparar estrategias.
              </p>
              <p>
                Si quieres llegar a lo más alto del ranking, necesitas práctica, estrategia y 
                constancia. ¿Estás listo para el desafío?
              </p>
            </div>
          </section>

          {/* Sección 6: Preguntas frecuentes (FAQ) */}
          <section>
            <h2 className="text-3xl font-black text-white mb-4">Preguntas frecuentes (FAQ)</h2>
            <div className="space-y-4 text-white/80">
              <div>
                <h3 className="font-bold text-white">1. ¿Es gratis jugar a STOP?</h3>
                <p>Sí, STOP es completamente gratuito. Puedes jugar todas las partidas que quieras sin pagar nada. Ofrecemos packs opcionales (Premium y Mundial) para quienes quieran apoyar el desarrollo y obtener cosméticos exclusivos.</p>
              </div>
              <div>
                <h3 className="font-bold text-white">2. ¿Cómo puedo registrarme?</h3>
                <p>Puedes registrarte con tu cuenta de Google, Facebook, Instagram, TikTok o como invitado. El registro es rápido y solo requiere un nombre de usuario y un correo electrónico.</p>
              </div>
              <div>
                <h3 className="font-bold text-white">3. ¿Qué necesito para jugar?</h3>
                <p>Solo necesitas un navegador web moderno (Chrome, Firefox, Safari, Edge) y conexión a Internet. También puedes instalar la app como PWA en tu dispositivo móvil para una experiencia más nativa.</p>
              </div>
              <div>
                <h3 className="font-bold text-white">4. ¿Cómo funcionan las monedas?</h3>
                <p>Ganas monedas al final de cada partida en función de tu puntuación. También puedes obtener monedas con el Pack Premium o participando en eventos especiales. Las monedas se gastan en la tienda para comprar cosméticos.</p>
              </div>
              <div>
                <h3 className="font-bold text-white">5. ¿Qué son los cosméticos?</h3>
                <p>Los cosméticos son elementos decorativos que personalizan tu perfil: avatares, marcos, fondos y títulos. No afectan a la jugabilidad, pero te permiten destacar y mostrar tu estilo.</p>
              </div>
              <div>
                <h3 className="font-bold text-white">6. ¿Cómo funciona el sistema de experiencia y niveles?</h3>
                <p>Ganas experiencia (XP) en cada partida. Al acumular suficiente XP, subes de nivel. Cada nivel desbloquea nuevas recompensas y cosméticos. Los niveles también influyen en tu posición en el ranking.</p>
              </div>
              <div>
                <h3 className="font-bold text-white">7. ¿Qué es el Pack Mundial?</h3>
                <p>El Pack Mundial es un pack de pago único que incluye 27 cosméticos exclusivos relacionados con el fútbol y el Mundial (avatares de banderas, balones, marcos, fondos). Es la manera más rápida de tener una colección completa y apoyar el juego.</p>
              </div>
              <div>
                <h3 className="font-bold text-white">8. ¿Puedo jugar con amigos?</h3>
                <p>Sí, puedes crear salas privadas y compartir el código con tus amigos. También puedes seguir a otros jugadores y ver su actividad en el ranking de amigos.</p>
              </div>
              <div>
                <h3 className="font-bold text-white">9. ¿Hay límite de jugadores por sala?</h3>
                <p>Las salas multijugador tienen un límite de 8 jugadores. Esto asegura partidas dinámicas y sin esperas excesivas.</p>
              </div>
              <div>
                <h3 className="font-bold text-white">10. ¿Cómo puedo contactar con soporte?</h3>
                <p>Puedes contactarnos a través de nuestra <a href="/contacto" className="text-secondary hover:underline">página de contacto</a> o enviando un correo a <a href="mailto:soporte@stopjuegodepalabras.com" className="text-secondary hover:underline">soporte@stopjuegodepalabras.com</a>.</p>
              </div>
            </div>
          </section>

          {/* Sección 7: Últimos artículos del blog */}
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
