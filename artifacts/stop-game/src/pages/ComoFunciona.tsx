import { Link } from "wouter";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

export default function ComoFunciona() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-10">
          <img src={LOGO_URL} alt="STOP" className="w-14 h-14 rounded-full" />
          <div>
            <h1 className="text-3xl font-black text-[hsl(48,96%,57%)]">Cómo funciona STOP El Juego</h1>
            <p className="text-white/50 text-sm">La experiencia online, sus modos y sistemas</p>
          </div>
        </div>

        <article className="space-y-10 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-2xl font-black text-white mb-3">Una versión online del juego de categorías</h2>
            <p className="mb-3">
              STOP El Juego lleva la mecánica clásica de completar categorías con una letra determinada a una experiencia online. La partida está pensada para funcionar tanto en ordenador como en móvil, con partidas rápidas y opciones para jugar solo o competir con otras personas.
            </p>
            <p>
              La web no es únicamente una página informativa: el contenido y los sistemas descritos aquí forman parte de la experiencia del propio juego. Las reglas, la puntuación, los retos, el ranking y los modos disponibles se integran en la plataforma para que una partida pueda empezar directamente desde el navegador.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white mb-3">Qué ocurre durante una ronda</h2>
            <ol className="list-decimal list-inside space-y-3">
              <li>Se prepara la ronda con una letra y un conjunto de categorías.</li>
              <li>El jugador escribe respuestas que empiecen por la letra indicada.</li>
              <li>El contador limita el tiempo disponible y permite jugar bajo presión.</li>
              <li>Al terminar la ronda se comparan y validan las respuestas.</li>
              <li>El resultado de la ronda se transforma en puntuación y progreso según el modo de juego.</li>
            </ol>
            <p className="mt-4">
              La idea es que la puntuación no dependa únicamente de escribir rápido. Encontrar una respuesta válida y poco habitual puede ser decisivo cuando las respuestas de varios jugadores coinciden.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white mb-3">Validación y puntuación</h2>
            <p className="mb-3">
              Una parte importante de una partida online es decidir qué respuestas cuentan. STOP utiliza la información de la ronda y de los participantes para calcular el resultado, en lugar de limitarse a mostrar un formulario sin consecuencias.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="font-black text-[hsl(48,96%,57%)] mb-1">Respuesta válida</h3>
                <p className="text-sm text-white/65">Puede sumar puntos cuando cumple las reglas de la categoría y la letra.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="font-black text-[hsl(48,96%,57%)] mb-1">Respuesta compartida</h3>
                <p className="text-sm text-white/65">Las coincidencias entre jugadores se tienen en cuenta al calcular la puntuación.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="font-black text-[hsl(48,96%,57%)] mb-1">Respuesta inválida</h3>
                <p className="text-sm text-white/65">Las respuestas que no cumplen las condiciones de la ronda no aportan la misma puntuación.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white mb-3">Jugar contra la IA</h2>
            <p>
              El modo Solo permite practicar sin esperar a otros jugadores. La IA completa su parte de la ronda y el jugador puede comparar el resultado, probar estrategias y repetir una partida para mejorar. Es una forma de aprender qué categorías se le dan mejor y cuáles necesitan más práctica.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white mb-3">Multijugador en tiempo real</h2>
            <p className="mb-3">
              En multijugador, los participantes comparten una misma ronda y un mismo contexto de juego. Las salas permiten invitar a otras personas mediante un código y jugar varias rondas antes de consultar el resultado final.
            </p>
            <p>
              El sistema está diseñado para que el servidor mantenga el estado de la partida y los resultados, de forma que abandonar y volver a entrar no convierta el marcador en una simple cifra controlada por el navegador.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white mb-3">Retos, ranking y temporadas</h2>
            <p className="mb-3">
              Además de las partidas normales, STOP incluye sistemas para volver a jugar: retos diarios, ranking y progresión. El reto diario ofrece una oportunidad de competir cada día, mientras que el ranking permite comparar el rendimiento acumulado.
            </p>
            <p>
              Las temporadas añaden objetivos y progresión temporal. Estos sistemas convierten las partidas individuales en una experiencia continuada: no se trata solo de ganar una ronda, sino de mejorar con el tiempo.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white mb-3">Por qué la experiencia es diferente según dónde juegues</h2>
            <p>
              STOP puede abrirse directamente desde un navegador de ordenador, móvil o tablet. La plataforma también dispone de integración con aplicaciones móviles. Cada entorno puede tener una presentación y una política de monetización distinta, pero la partida y los datos importantes del juego deben conservar su comportamiento.
            </p>
            <p className="mt-3">
              En la versión web, la publicidad se reserva para la superficie del sitio que puede monetizarse sin convertir los controles de una partida en objetivos publicitarios. La prioridad es que un anuncio no tape un botón, una respuesta, un temporizador ni una acción necesaria para jugar.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white mb-3">Guías para aprender y mejorar</h2>
            <p>
              Si buscas las reglas completas, consulta la <Link href="/como-jugar" className="text-[hsl(48,96%,57%)] hover:underline">guía de cómo jugar</Link>. Para técnicas y vocabulario puedes visitar las <Link href="/estrategias" className="text-[hsl(48,96%,57%)] hover:underline">estrategias</Link> o el <Link href="/blog" className="text-[hsl(48,96%,57%)] hover:underline">blog de STOP</Link>.
            </p>
          </section>
        </article>

        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <Link href="/solo">
            <button className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-lg" style={{ background: "hsl(6,90%,55%)", color: "white" }}>
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
