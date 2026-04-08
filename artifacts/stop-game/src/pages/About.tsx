import { Link } from "wouter";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

export default function About() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">

        <div className="flex items-center gap-4 mb-8">
          <img src={LOGO_URL} alt="STOP El Juego" className="w-16 h-16 rounded-full shadow-lg" />
          <div>
            <h1 className="text-3xl font-black text-[hsl(48,96%,57%)]">STOP — El Juego</h1>
            <p className="text-white/50 text-sm">Versión web · 2026 · Juego de palabras online gratuito</p>
          </div>
        </div>

        <section className="space-y-10 text-white/80 leading-relaxed">

          <div>
            <h2 className="text-2xl font-black text-white mb-3">¿Qué es STOP El Juego?</h2>
            <p className="mb-3">
              STOP El Juego es la versión digital más completa del clásico juego de palabras que conocemos como Tutti Frutti, Basta o Scattergories. En cada ronda, el sistema sortea una letra al azar y los jugadores disponen de 60 segundos para completar categorías de palabras — todas deben comenzar por esa letra.
            </p>
            <p className="mb-3">
              Lo que hace única a esta versión es la combinación de la mecánica clásica con características modernas: inteligencia artificial que compite contigo, partidas multijugador en tiempo real con amigos de todo el mundo, ranking global actualizado al instante, cartas de poder para cambiar el resultado de una ronda, y el sistema de bluff social "Mentir es Válido" que convierte cada partida en un juego psicológico.
            </p>
            <p>
              Es completamente gratuito, funciona en cualquier navegador y no requiere instalación. También está disponible como app instalable (PWA) en Android a través de Google Play.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Nuestra misión</h2>
            <p className="mb-3">
              Creemos que los mejores juegos son los que se juegan con otras personas. STOP El Juego nació con una misión clara: devolver a las pantallas la magia de aquellos ratos con familia y amigos alrededor de un papel, ahora conectando jugadores de España, México, Argentina, Chile, Colombia, Brasil, Francia y de cualquier rincón del mundo.
            </p>
            <p>
              Cada decisión de diseño y cada nueva función apuntan al mismo objetivo: que cada partida sea divertida, justa, rápida y social. Que jugar STOP en el móvil se sienta tan bien como jugarlo en papel.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Historia y origen del juego</h2>
            <p className="mb-3">
              El juego de palabras por categorías tiene raíces que se remontan a principios del siglo XX. En los años 50 y 60 ya existían versiones en papel en varios países de Europa y América Latina. En 1988, la empresa Milton Bradley lanzó <em>Scattergories</em>, la versión de mesa estandarizada que popularizó el formato en el mundo anglosajón.
            </p>
            <p className="mb-3">
              En el mundo hispanohablante el juego se extendió de manera informal, sin necesidad de tablero ni tarjetas: bastaba con papel, lápiz y un dado. En México y Argentina se le llama "Tutti Frutti" por las categorías de frutas y verduras que suelen incluirse. En España se popularizó como "Stop" o "El Juego de las Palabras". En Brasil se conoce como "Stop" o "Adedonha".
            </p>
            <p>
              STOP El Juego lleva ese legado al mundo digital en 2025, actualizando las reglas para el contexto online: validación automática, puntuación en tiempo real, sistema de ligas y mecánicas estratégicas que no son posibles con papel y lápiz.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Modos de juego disponibles</h2>
            <div className="space-y-3">
              {[
                {
                  icon: "🤖", title: "Solo vs Inteligencia Artificial",
                  desc: "Juega contra una IA que también busca palabras en tiempo real. La IA tiene diferentes personalidades — el Clásico, el Trolero, el Filosófico — para que cada partida sea distinta. Modo ideal para practicar y mejorar el vocabulario.",
                },
                {
                  icon: "👥", title: "Multijugador en Tiempo Real",
                  desc: "Crea una sala privada y comparte el código con amigos, o únete a una sala pública para jugar contra desconocidos de cualquier parte del mundo. Hasta 8 jugadores por sala, con chat y reacciones en tiempo real.",
                },
                {
                  icon: "📅", title: "Reto Diario",
                  desc: "Cada día hay una letra diferente para todos los jugadores del mundo. Completa el reto y compara tu puntuación con el ranking global del día. Solo tienes una oportunidad por día.",
                },
                {
                  icon: "🌀", title: "Modo Caos",
                  desc: "Las categorías son inusuales e inesperadas: 'Excusa para llegar tarde', 'Superpoder ridículo', 'Cosa que llevarías a una isla desierta'. No basta con saber vocabulario — hace falta imaginación y humor.",
                },
                {
                  icon: "⚡", title: "Modo Rápido",
                  desc: "Una sola ronda de 30 segundos. Sin tiempo para dudar: escribe lo primero que te venga a la cabeza. El modo más adrenalínico de STOP.",
                },
              ].map(m => (
                <div key={m.title} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <h3 className="font-bold text-white mb-1">{m.icon} {m.title}</h3>
                  <p className="text-sm text-white/70">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Mecánicas únicas</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border" style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.25)" }}>
                <h3 className="font-bold text-purple-300 mb-2">🃏 Cartas de Poder</h3>
                <p className="text-sm text-white/70 mb-2">
                  Al inicio de cada ronda recibes una carta aleatoria que puedes usar una sola vez. Las tres cartas disponibles son:
                </p>
                <ul className="text-sm text-white/60 space-y-1 list-disc list-inside">
                  <li><strong className="text-white">Oráculo:</strong> Revela la respuesta de la IA en una categoría antes de escribir.</li>
                  <li><strong className="text-white">Robo:</strong> Copia la respuesta de la IA en la categoría que elijas.</li>
                  <li><strong className="text-white">Sabotaje:</strong> Anula la respuesta de la IA y transfiere sus puntos a ti.</li>
                </ul>
              </div>
              <div className="p-4 rounded-2xl border" style={{ background: "rgba(250,204,21,0.08)", borderColor: "rgba(250,204,21,0.25)" }}>
                <h3 className="font-bold text-yellow-300 mb-2">🎭 Mentir es Válido</h3>
                <p className="text-sm text-white/70">
                  El sistema de bluff que convierte STOP en un juego psicológico. Puedes marcar hasta 2 respuestas como "apuesta" — si otros jugadores no te descubren, ganas puntos extra. Si te pillan, pierdes. Una capa de estrategia social que va mucho más allá del vocabulario.
                </p>
              </div>
              <div className="p-4 rounded-2xl border" style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.25)" }}>
                <h3 className="font-bold text-green-300 mb-2">⭐ Sistema de Ligas</h3>
                <p className="text-sm text-white/70">
                  Cada partida ganas XP que suben tu nivel: Bronce → Plata → Oro → Diamante → Maestro. Las rachas de partidas diarias multiplican el XP ganado. Tu liga es visible en el ranking global.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Sistema de amigos y comunidad</h2>
            <p className="mb-3">
              Una vez registrado con tu cuenta de Google, Facebook o Instagram, puedes seguir a otros jugadores y ver cuándo están en línea. Cuando un amigo empieza a jugar, recibirás una notificación push (si la tienes activada) para poder retarle directamente a una sala.
            </p>
            <p>
              También puedes enviar retos directos: el sistema crea una sala automáticamente y el amigo recibe una notificación con el código para unirse. La comunidad de STOP El Juego crece cada día con jugadores de toda España y América Latina.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Ranking global</h2>
            <p className="mb-3">
              El ranking muestra los jugadores con más puntos acumulados en los últimos 7 días y en el histórico total. Se actualiza automáticamente tras cada partida. Puedes ver el perfil de cualquier jugador: partidas jugadas, victorias, racha máxima y puntuación total.
            </p>
            <p>
              El ranking semanal se reinicia cada lunes a medianoche UTC, lo que da a todos los jugadores la oportunidad de competir por el número uno cada semana, sin importar cuánto tiempo lleven jugando.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Idiomas disponibles</h2>
            <p className="mb-3">
              STOP El Juego está disponible en <strong className="text-white">Español, Inglés, Portugués y Francés</strong>. El idioma afecta tanto a la interfaz como a las categorías y a las respuestas del modo Solo vs IA — la IA responde en el mismo idioma que hayas seleccionado.
            </p>
            <p>
              Puedes cambiar el idioma en cualquier momento desde la pantalla principal pulsando el icono de idioma. El cambio es inmediato y no requiere reiniciar la partida.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">STOP Premium</h2>
            <p className="mb-3">
              La suscripción Premium elimina los anuncios y desbloquea acceso prioritario a nuevas funciones, categorías exclusivas y una insignia especial en el ranking. Está disponible por <strong className="text-[hsl(48,96%,57%)]">1,99 € al mes</strong> o <strong className="text-[hsl(48,96%,57%)]">14,99 € al año</strong>.
            </p>
            <p>
              Puedes cancelar en cualquier momento desde la sección Premium de tu perfil. El pago se procesa de forma segura a través de Stripe.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Accesibilidad y compatibilidad</h2>
            <p className="mb-3">
              STOP El Juego está diseñado para funcionar en cualquier dispositivo: móviles Android e iOS, tablets, ordenadores de sobremesa y portátiles. No requiere instalación — basta con abrir el navegador y jugar.
            </p>
            <p className="mb-3">
              También está disponible como <strong className="text-white">app instalable en Android</strong> a través de Google Play, bajo el nombre "STOP El Juego de Palabras". La app usa tecnología PWA/TWA para ofrecer la misma experiencia que la web pero integrada en el sistema operativo.
            </p>
            <p>
              El sitio está optimizado para conexiones lentas: una vez cargado, el modo Solo vs IA puede jugarse con cobertura mínima. El modo Multijugador requiere conexión estable para la sincronización en tiempo real.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Guías y recursos</h2>
            <div className="flex flex-col gap-3">
              <Link href="/como-jugar">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                  <p className="font-bold text-[hsl(48,96%,57%)]">📖 Guía completa de cómo jugar →</p>
                  <p className="text-sm text-white/50 mt-1">Reglas detalladas, sistema de puntuación, modos y estrategias.</p>
                </div>
              </Link>
              <Link href="/estrategias">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                  <p className="font-bold text-[hsl(48,96%,57%)]">🧠 Estrategias y trucos por letra →</p>
                  <p className="text-sm text-white/50 mt-1">Las mejores palabras para cada letra del abecedario.</p>
                </div>
              </Link>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white mb-3">Contacto y soporte</h2>
            <p className="mb-3">
              ¿Tienes sugerencias, encontraste un error, quieres reportar un jugador o necesitas eliminar tu cuenta? Escríbenos a:
            </p>
            <a
              href="mailto:stopeljuegodepalabras@gmail.com"
              className="inline-block px-6 py-3 rounded-2xl font-bold text-[hsl(222,47%,11%)] bg-[hsl(48,96%,57%)] hover:opacity-90 transition-opacity"
            >
              stopeljuegodepalabras@gmail.com
            </a>
            <p className="mt-4 text-sm text-white/50">
              Respondemos en un plazo máximo de 48 horas laborables. Para solicitudes de eliminación de datos personales, consulta nuestra <Link href="/privacy" className="underline text-white/70">Política de Privacidad</Link>.
            </p>
          </div>

          <div className="pt-6 border-t border-white/10">
            <p className="text-white/40 text-sm">
              STOP El Juego es un proyecto independiente. No está afiliado a Hasbro, Milton Bradley ni ninguna otra marca comercial.
              El concepto Scattergories es una marca registrada de sus respectivos propietarios. Esta versión digital es una creación original.
            </p>
          </div>

        </section>

        <div className="mt-10 flex gap-4 flex-wrap">
          <Link href="/como-jugar" className="text-[hsl(48,96%,57%)] hover:underline text-sm">Cómo Jugar</Link>
          <Link href="/estrategias" className="text-[hsl(48,96%,57%)] hover:underline text-sm">Estrategias</Link>
          <Link href="/privacy" className="text-[hsl(48,96%,57%)] hover:underline text-sm">Política de Privacidad</Link>
          <Link href="/terms" className="text-[hsl(48,96%,57%)] hover:underline text-sm">Términos de Uso</Link>
          <Link href="/" className="text-[hsl(48,96%,57%)] hover:underline text-sm">← Volver al juego</Link>
        </div>
      </div>
    </div>
  );
}
