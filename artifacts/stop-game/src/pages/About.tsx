import { Link } from "wouter";

export default function About() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] text-white px-6 py-12 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <img
          src={`${import.meta.env.BASE_URL}images/stop-logo.png`}
          alt="STOP"
          className="w-16 h-16 rounded-full shadow-lg"
        />
        <div>
          <h1 className="text-3xl font-black text-[hsl(48,96%,57%)]">STOP — El Juego</h1>
          <p className="text-white/50 text-sm">Versión web · 2026</p>
        </div>
      </div>

      <section className="space-y-8 text-white/80 leading-relaxed">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">¿Qué es STOP?</h2>
          <p>
            STOP es la versión digital del clásico juego de palabras Scattergories. En cada ronda
            se sortea una letra al azar y tienes 60 segundos para completar categorías como
            <em> Animal, Color, Fruta, País, Marca</em> y más — todas empezando por esa letra.
            Compite contra la IA, desafía a tus amigos en multijugador y escala en el ranking global.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-2">Modos de juego</h2>
          <ul className="list-disc list-inside space-y-1 text-white/70">
            <li><span className="text-white font-semibold">Solo vs IA</span> — juega contra una inteligencia artificial que también busca palabras.</li>
            <li><span className="text-white font-semibold">Multijugador</span> — crea o únete a salas privadas con amigos.</li>
            <li><span className="text-white font-semibold">Reto Diario</span> — una letra nueva cada día, ranking mundial.</li>
            <li><span className="text-white font-semibold">Modo Caos</span> — categorías cambian en tiempo real.</li>
            <li><span className="text-white font-semibold">Modo Rápido</span> — 30 segundos para respuestas exprés.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-2">Mecánicas especiales</h2>
          <ul className="list-disc list-inside space-y-1 text-white/70">
            <li><span className="text-white font-semibold">🃏 Cartas de Poder</span> — Oráculo, Robo y Sabotaje para cambiar el resultado de una ronda.</li>
            <li><span className="text-white font-semibold">🎭 Mentir es Válido</span> — engaña a la IA o descúbrela mintiendo.</li>
            <li><span className="text-white font-semibold">⭐ Liga</span> — sube desde Bronce hasta Maestro acumulando puntos.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-2">Idiomas</h2>
          <p>Disponible en <span className="text-white font-semibold">Español, Inglés, Portugués y Francés</span>.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-2">Plataformas</h2>
          <p>Jugable desde cualquier navegador. Próximamente disponible en <span className="text-white font-semibold">Google Play</span> como aplicación nativa.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-2">Contacto</h2>
          <p>
            ¿Tienes sugerencias, encontraste un error o quieres eliminar tu cuenta?<br />
            Escríbenos a:{" "}
            <a
              href="mailto:jdorta2206@gmail.com"
              className="text-[hsl(48,96%,57%)] underline"
            >
              jdorta2206@gmail.com
            </a>
          </p>
        </div>

        <div className="pt-4 border-t border-white/10">
          <p className="text-white/40 text-sm">
            STOP — El Juego es un proyecto independiente. No está afiliado a ninguna marca comercial.
            El concepto Scattergories es una marca registrada de sus respectivos propietarios.
          </p>
        </div>
      </section>

      <div className="mt-10 flex gap-4 flex-wrap">
        <Link href="/privacy" className="text-[hsl(48,96%,57%)] hover:underline text-sm">
          Política de Privacidad
        </Link>
        <Link href="/terms" className="text-[hsl(48,96%,57%)] hover:underline text-sm">
          Términos de Uso
        </Link>
        <Link href="/" className="text-[hsl(48,96%,57%)] hover:underline text-sm">
          ← Volver al juego
        </Link>
      </div>
    </div>
  );
}
