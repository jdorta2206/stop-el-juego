import { Link } from "wouter";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

export default function ComoFunciona() {
  return (
    <main className="min-h-screen bg-[hsl(222,47%,11%)] text-white">
      <article className="max-w-3xl mx-auto px-6 py-12">
        <header className="flex items-center gap-4 mb-10">
          <img src={LOGO_URL} alt="STOP El Juego" className="w-14 h-14 rounded-full" />
          <div>
            <h1 className="text-3xl font-black text-[hsl(48,96%,57%)]">Cómo funciona STOP El Juego</h1>
            <p className="text-white/60 text-sm">De la preparación de una ronda al resultado final</p>
          </div>
        </header>

        <div className="space-y-9 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">La mecánica central</h2>
            <p>STOP es un juego de categorías y palabras. Cada ronda combina una letra con varias categorías. Tu tarea es encontrar una respuesta que empiece por esa letra y que corresponda a cada categoría antes de que termine el tiempo.</p>
            <p className="mt-3">La dificultad no depende solo de recordar palabras: también hay que interpretar bien la categoría, elegir una respuesta adecuada y repartir el tiempo entre las casillas.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Cómo avanza una partida</h2>
            <ol className="list-decimal list-inside space-y-3">
              <li><strong>Elección del modo:</strong> selecciona una modalidad individual o multijugador entre las que estén disponibles.</li>
              <li><strong>Preparación:</strong> revisa las categorías y las instrucciones específicas de esa partida.</li>
              <li><strong>Inicio de ronda:</strong> aparece la letra que deben respetar las respuestas.</li>
              <li><strong>Escritura:</strong> completa las categorías mientras el contador está activo.</li>
              <li><strong>Cierre:</strong> utiliza STOP cuando el modo lo permita o espera a que termine el tiempo.</li>
              <li><strong>Resultado:</strong> consulta las respuestas y la puntuación que corresponda a esa modalidad.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Por qué cambia el tiempo</h2>
            <p>No existe una duración única para todas las partidas. Los modos individuales y las variantes rápidas o especiales pueden utilizar contadores distintos; en multijugador, la configuración de la sala también determina las condiciones de la ronda. Por eso debes tomar como referencia el temporizador y las instrucciones que aparecen en pantalla, no una cifra general publicada fuera del juego.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Cómo se valoran las respuestas</h2>
            <p>Una respuesta debe cumplir dos condiciones básicas: comenzar por la letra indicada y encajar en la categoría. Una palabra que empiece por la letra correcta pero no responda a lo que pide la categoría no es una respuesta adecuada.</p>
            <p className="mt-3">Las coincidencias entre participantes y las reglas de puntuación pueden variar según el modo. Al terminar, revisa el resultado de la partida para ver cómo se han valorado las respuestas en esa ronda.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Partida individual y multijugador</h2>
            <p>En el modo individual puedes practicar sin esperar a que se conecten otras personas. En multijugador puedes crear una sala y compartir su código para que otras personas se unan. La pantalla de cada modalidad indica sus condiciones antes de empezar.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Cómo mejorar con la práctica</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Lee todas las categorías antes de empezar a escribir.</li>
              <li>Resuelve primero las categorías en las que tengas una respuesta clara.</li>
              <li>Si te bloqueas, continúa con otra casilla y vuelve después si queda tiempo.</li>
              <li>Comprueba que cada respuesta cumple tanto la letra como la categoría.</li>
              <li>Después de la ronda, revisa las respuestas que no conocías y consulta las guías del blog.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Más información</h2>
            <p>La <Link href="/como-jugar" className="text-[hsl(48,96%,57%)] hover:underline">guía para aprender a jugar</Link> explica los pasos básicos. En el <Link href="/blog" className="text-[hsl(48,96%,57%)] hover:underline">blog</Link> encontrarás artículos de vocabulario y estrategias; si necesitas ayuda, puedes <Link href="/contacto" className="text-[hsl(48,96%,57%)] hover:underline">contactar con el equipo</Link>.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
