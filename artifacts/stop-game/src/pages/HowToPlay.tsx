import { Link } from "wouter";
import { useT } from "@/i18n/useT";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

export default function HowToPlay() {
  const { t } = useT();

  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">

        <div className="flex items-center gap-4 mb-8">
          <img src={LOGO_URL} alt="STOP" className="w-14 h-14 rounded-full" />
          <div>
            <h1 className="text-3xl font-black text-[hsl(48,96%,57%)]">¿Cómo se juega a STOP?</h1>
            <p className="text-white/50 text-sm">Guía completa del juego de palabras</p>
          </div>
        </div>

        <section className="space-y-10 text-white/80 leading-relaxed">

          <div>
            <h2 className="text-2xl font-black text-white mb-3">¿Qué es STOP?</h2>
            <p className="mb-3">
              STOP (también conocido como Scattergories, Tutti Frutti o Basta) es un clásico juego de palabras que se practica en todo el mundo. El objetivo es completar categorías de palabras que empiecen por una letra concreta antes de que lo haga cualquier otro jugador.
            </p>
            <p>
              En nuestra versión digital puedes jugar en solitario contra la inteligencia artificial o en multijugador en tiempo real con personas de cualquier parte del mundo. Además, dispones de un ranking global donde ver tu posición frente a miles de jugadores.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Reglas básicas</h2>
            <ol className="list-decimal list-inside space-y-3">
              <li>Al inicio de cada ronda se sortea una <strong className="text-[hsl(48,96%,57%)]">letra al azar</strong> del abecedario.</li>
              <li>Tienes <strong className="text-[hsl(48,96%,57%)]">60 segundos</strong> para rellenar todas las categorías con palabras que comiencen por esa letra.</li>
              <li>El primer jugador que complete todas las casillas puede pulsar <strong className="text-[hsl(6,90%,55%)]">¡STOP!</strong> para detener el tiempo.</li>
              <li>Cuando se acaba el tiempo o alguien grita STOP, se muestran todas las respuestas de los jugadores.</li>
              <li>Las respuestas válidas suman puntos; las repetidas o incorrectas, no.</li>
            </ol>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Sistema de puntuación</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="font-bold text-[hsl(48,96%,57%)] mb-1">Respuesta única — 10 puntos</h3>
                <p className="text-sm">Si tu respuesta es la única válida en esa categoría, consigues 10 puntos completos.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="font-bold text-[hsl(48,96%,57%)] mb-1">Respuesta repetida — 5 puntos</h3>
                <p className="text-sm">Si otro jugador escribió la misma palabra, ambos recibís 5 puntos en lugar de 10.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="font-bold text-[hsl(48,96%,57%)] mb-1">Respuesta incorrecta o en blanco — 0 puntos</h3>
                <p className="text-sm">Las palabras que no empiezan por la letra correcta o que quedan vacías no puntúan.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="font-bold text-[hsl(48,96%,57%)] mb-1">Bonus por ser primero — +5 puntos</h3>
                <p className="text-sm">Si eres el primero en gritar STOP y completas todas las categorías, recibes puntos extra.</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Categorías del juego</h2>
            <p className="mb-4">
              STOP incluye categorías clásicas y variadas para mantener el juego entretenido. Algunas de las más habituales son:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: "👤", name: "Nombre", desc: "Nombre propio de persona (María, Juan, Alejandro...)" },
                { emoji: "🌍", name: "Lugar", desc: "País, ciudad o región (México, Berlín, Ávila...)" },
                { emoji: "🐾", name: "Animal", desc: "Cualquier animal del reino animal (Murciélago, Nutria...)" },
                { emoji: "📦", name: "Objeto", desc: "Cosa o artículo cotidiano (Mesa, Nevera, Ordenador...)" },
                { emoji: "🎨", name: "Color", desc: "Color o tonalidad (Magenta, Negro, Naranja...)" },
                { emoji: "🍎", name: "Fruta", desc: "Fruta o fruto comestible (Mango, Naranja, Nectarina...)" },
                { emoji: "🏷️", name: "Marca", desc: "Marca comercial conocida (Nike, Mercedes, Nestlé...)" },
                { emoji: "⚽", name: "Deporte", desc: "Modalidad deportiva (Natación, Baloncesto...)" },
              ].map((cat) => (
                <div key={cat.name} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="font-bold text-[hsl(48,96%,57%)]">{cat.name}</span>
                  </div>
                  <p className="text-xs text-white/60">{cat.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Modo Solo vs IA</h2>
            <p className="mb-3">
              En el modo individual juegas contra un oponente de inteligencia artificial que responde de forma autónoma a cada categoría. Es el modo perfecto para practicar, mejorar tu vocabulario y calentar antes de enfrentarte a jugadores reales.
            </p>
            <p>
              La IA tiene diferentes personalidades (el Clásico, el Trolero, el Filosófico…) que cambian con cada partida, haciendo cada ronda única y sorprendente.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">⚡ Quick Mode</h2>
            <p className="mb-3">
              Una partida relámpago de <strong className="text-[hsl(48,96%,57%)]">30 segundos y 1 sola ronda</strong>. Perfecta cuando quieres una partida rápida. Ideal para competir contra tu propio récord o calentar antes de una partida larga.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">🌀 Chaos Mode</h2>
            <p className="mb-3">
              El modo más loco de STOP. Las categorías son inesperadas e inusuales: <em>"Excusa para llegar tarde"</em>, <em>"Superpoder ridículo"</em>, <em>"Cosa que nunca harías"</em>, <em>"Cosa que llevarías a una isla desierta"</em>… Aquí no basta con saber vocabulario — ¡hace falta imaginación!
            </p>
            <p>
              Algunas categorías tienen respuestas curadas (solo palabras que realmente tengan sentido), mientras que otras son completamente abiertas. Las respuestas únicas y creativas consiguen los 10 puntos completos.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">🃏 Cartas de Poder</h2>
            <p className="mb-3">
              Cada partida recibes <strong className="text-[hsl(48,96%,57%)]">una Carta de Poder aleatoria</strong> que puedes usar una sola vez durante la ronda para cambiar el rumbo de la partida. Hay tres tipos:
            </p>
            <div className="space-y-3">
              <div className="p-4 rounded-2xl border" style={{ background: "rgba(139,92,246,0.1)", borderColor: "rgba(139,92,246,0.3)" }}>
                <h3 className="font-bold mb-1" style={{ color: "#a78bfa" }}>🔮 Oráculo</h3>
                <p className="text-sm text-white/70">Revela la respuesta correcta de la IA en una categoría de tu elección antes de escribir. Úsala cuando estés atascado en una categoría difícil.</p>
              </div>
              <div className="p-4 rounded-2xl border" style={{ background: "rgba(249,168,37,0.1)", borderColor: "rgba(249,168,37,0.3)" }}>
                <h3 className="font-bold mb-1" style={{ color: "#fbbf24" }}>⚡ Robo</h3>
                <p className="text-sm text-white/70">Copia la respuesta de la IA en la categoría que elijas. Los puntos de esa categoría son tuyos — pero solo si la IA tenía una respuesta válida.</p>
              </div>
              <div className="p-4 rounded-2xl border" style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" }}>
                <h3 className="font-bold mb-1" style={{ color: "#f87171" }}>💣 Sabotaje</h3>
                <p className="text-sm text-white/70">Anula la respuesta de la IA en una categoría y transfiere sus puntos directamente a tu marcador. Un swing de hasta +20 puntos en el marcador de la ronda.</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/50">Cada ronda recibes una carta distinta al azar. Solo puedes usarla una vez por ronda y en la categoría que elijas.</p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">🎭 Mentir es Válido</h2>
            <p className="mb-3">
              El sistema de <strong className="text-[hsl(48,96%,57%)]">bluff social</strong> que diferencia a STOP de cualquier otro juego de palabras. Funciona así:
            </p>
            <ol className="list-decimal list-inside space-y-3 mb-4">
              <li><strong>Fase de escritura:</strong> Rellena tus categorías normalmente. Si no sabes una palabra, puedes intentar <em>bluffear</em> — escribir algo que suene creíble aunque no sea la respuesta correcta.</li>
              <li><strong>Fase de juicio (solo modo Solo):</strong> Antes de ver los resultados finales, la IA desafía algunas de tus respuestas. Tú decides si <em>defender</em> tu respuesta o <em>retractarte</em>.</li>
              <li><strong>Resultado:</strong> Si defiendes una respuesta válida, ganas los puntos. Si defiendes un bluff y la IA lo descubre, pierdes puntos. Si la IA te desafía una respuesta correcta y tú la defiendes, ¡la IA pierde puntos!</li>
            </ol>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-sm text-white/70"><strong className="text-white">Consejo:</strong> El bluff es más efectivo en categorías abiertas como "Color" o "Animal" donde hay miles de respuestas posibles. En categorías cerradas como "Marca" o "Deporte", la IA tiene más contexto para detectarte.</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">⭐ Sistema de Ligas y Progresión</h2>
            <p className="mb-3">
              Cada partida ganas <strong className="text-[hsl(48,96%,57%)]">XP (puntos de experiencia)</strong> que van subiendo tu nivel. Al subir niveles desbloqueas ligas superiores:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: "🥉", name: "Bronce", desc: "Nivel 1 — punto de partida", color: "#cd7f32" },
                { emoji: "🥈", name: "Plata", desc: "Nivel 5 — jugador habitual", color: "#9ca3af" },
                { emoji: "🥇", name: "Oro", desc: "Nivel 10 — experto en palabras", color: "#f9a825" },
                { emoji: "💎", name: "Diamante", desc: "Nivel 15 — élite", color: "#60a5fa" },
                { emoji: "👑", name: "Maestro", desc: "Nivel 20 — leyenda del STOP", color: "#a78bfa" },
              ].map((league) => (
                <div key={league.name} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{league.emoji}</span>
                    <span className="font-bold" style={{ color: league.color }}>{league.name}</span>
                  </div>
                  <p className="text-xs text-white/60">{league.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-white/50">Tu liga y nivel son visibles en el ranking global. También puedes mantener rachas de partidas diarias para bonus de XP extra.</p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Modo Multijugador en tiempo real</h2>
            <p className="mb-3">
              El modo multijugador te permite crear una sala privada o unirte a una ya existente. Puedes compartir el código de sala con tus amigos para que se unan directamente. Las partidas son en tiempo real: todos ven el mismo temporizador y las respuestas aparecen simultáneamente al terminar la ronda.
            </p>
            <p className="mb-3">
              También puedes activar las salas públicas para que cualquier jugador del mundo pueda unirse a tu partida. Las partidas multijugador pueden tener entre 2 y 8 jugadores.
            </p>
            <p>
              Al finalizar una partida multijugador, todos los participantes reciben puntos según su rendimiento. Estos puntos se acumulan en el ranking global.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Ranking Global</h2>
            <p className="mb-3">
              El ranking global clasifica a todos los jugadores registrados según su puntuación acumulada. Para aparecer en el ranking necesitas iniciar sesión con Google, Facebook o Instagram.
            </p>
            <p>
              El ranking se actualiza en tiempo real tras cada partida. Puedes ver las estadísticas de cada jugador: partidas jugadas, victorias, racha máxima y puntuación total. ¡Compite para llegar al número uno!
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">STOP Premium</h2>
            <p className="mb-3">
              Con la suscripción Premium disfrutas de una experiencia sin interrupciones publicitarias. Además, desbloqueas categorías exclusivas, acceso prioritario a nuevas funciones y una insignia especial que te distingue en el ranking.
            </p>
            <p>
              El plan Premium está disponible por <strong className="text-[hsl(48,96%,57%)]">€1,99 al mes</strong> o <strong className="text-[hsl(48,96%,57%)]">€14,99 al año</strong> (equivalente a €1,25 al mes). Puedes cancelar en cualquier momento.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Consejos y estrategias</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Empieza por las categorías más fáciles</strong> para ti y deja las difíciles para el final.</li>
              <li><strong>Piensa en nombres propios</strong> — son útiles para categorías como "Nombre" o "Lugar" y raramente coinciden con otros jugadores.</li>
              <li><strong>Letras como la Q, X o Z</strong> son más difíciles pero todos los jugadores tienen el mismo problema, así que palabras sencillas pueden ser únicas.</li>
              <li><strong>No repitas palabras entre categorías</strong> aunque la misma palabra sirva para varias (p.ej. "Naranja" puede ser fruta y color).</li>
              <li><strong>Practica en modo Solo</strong> para mejorar tu velocidad antes de competir online.</li>
              <li><strong>Si no sabes nada</strong> para una letra difícil, intenta al menos poner algo en cada casilla — los 0 puntos no te ayudan.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Preguntas frecuentes</h2>
            <div className="space-y-4">
              {[
                {
                  q: "¿Es gratis jugar a STOP?",
                  a: "Sí, STOP es completamente gratuito. Puedes jugar sin registrarte como invitado. Si te registras, puedes guardar tus puntuaciones y aparecer en el ranking global.",
                },
                {
                  q: "¿Puedo jugar sin internet?",
                  a: "El modo Solo vs IA requiere conexión a internet para cargar el juego, pero una vez cargado funciona con conexiones lentas. El modo Multijugador requiere conexión estable.",
                },
                {
                  q: "¿Qué idiomas están disponibles?",
                  a: "STOP está disponible en español, inglés, portugués y francés. Puedes cambiar el idioma desde la pantalla principal.",
                },
                {
                  q: "¿Puedo jugar en el móvil?",
                  a: "Sí. STOP funciona perfectamente en cualquier móvil o tablet. También está disponible como app en Google Play Store para Android.",
                },
                {
                  q: "¿Cómo se validan las respuestas?",
                  a: "Las respuestas se validan automáticamente comparando con el resto de jugadores. Una respuesta es válida si empieza por la letra correcta. Si hay dudas, los jugadores pueden votar para aceptarla o rechazarla.",
                },
                {
                  q: "¿Cuántos jugadores pueden jugar a la vez?",
                  a: "En el modo multijugador pueden participar entre 2 y 8 jugadores por sala. En el modo solo juegas tú contra la IA.",
                },
              ].map((faq, i) => (
                <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <h3 className="font-bold text-white mb-2">{faq.q}</h3>
                  <p className="text-sm text-white/70">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Historia del juego</h2>
            <p className="mb-3">
              STOP es una adaptación digital del popular juego de mesa Scattergories, creado en 1988 por Milton Bradley. En América Latina se conoce popularmente como "Tutti Frutti" o "Basta", y en España simplemente como "Stop". Es uno de los juegos de mesa más jugados en habla hispana.
            </p>
            <p>
              Nuestra versión digital mantiene la esencia del juego original añadiendo características modernas como el multijugador en línea en tiempo real, ranking global, inicio de sesión con redes sociales y soporte para múltiples idiomas.
            </p>
          </div>

        </section>

        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <Link href="/solo">
            <button
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-lg"
              style={{ background: "hsl(6,90%,55%)", color: "white" }}
            >
              ¡Jugar ahora!
            </button>
          </Link>
          <Link href="/">
            <button className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-lg border-2 border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all">
              ← Volver al inicio
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}
