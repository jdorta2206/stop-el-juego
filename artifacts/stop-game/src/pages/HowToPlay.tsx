export default function HowToPlay() {
  return (
    <main className="min-h-screen bg-[hsl(222,47%,11%)] text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-black text-[hsl(48,96%,57%)]">Cómo jugar a STOP El Juego</h1>
          <p className="text-white/60 text-sm mt-2">Reglas básicas para empezar una partida</p>
        </header>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">1. Elige una modalidad</h2>
            <p>En la pantalla de inicio, selecciona una de las modalidades disponibles. Puedes jugar en solitario contra la inteligencia artificial o entrar en una partida multijugador, por ejemplo creando una sala y compartiendo su código con otras personas.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">2. Lee la letra y las categorías</h2>
            <p>Al comenzar la ronda se muestra una letra y aparecen las categorías que debes completar. Las categorías pueden cambiar según la modalidad o la configuración de la partida.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">3. Escribe tus respuestas</h2>
            <p>Escribe una palabra o expresión que empiece por la letra indicada y que corresponda a cada categoría. Si no encuentras una respuesta, puedes dejar esa casilla sin completar y continuar con las demás.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">4. Termina la ronda</h2>
            <p>El tiempo disponible depende de la modalidad. Cuando hayas terminado, utiliza el control STOP si está disponible; si no, la ronda se cerrará al agotarse el contador. Sigue las indicaciones que aparezcan en pantalla.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">5. Revisa el resultado</h2>
            <p>Al cerrar la ronda podrás consultar las respuestas y el resultado. Para que una respuesta sea válida debe comenzar por la letra de la ronda y encajar en la categoría. La puntuación y los efectos de las respuestas repetidas dependen de las reglas de la modalidad.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Consejos para jugar</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Empieza por las categorías para las que encuentres una respuesta con facilidad.</li>
              <li>Si te bloqueas, pasa a otra categoría y vuelve después si queda tiempo.</li>
              <li>Comprueba que la palabra empieza por la letra correcta y que responde a lo que pide la categoría.</li>
              <li>Antes de una partida, revisa las instrucciones específicas del modo que hayas elegido.</li>
            </ul>
          </section>
          <nav className="border-t border-white/10 pt-6 flex flex-wrap gap-4 text-[hsl(48,96%,57%)]">
            <a href="/" className="hover:underline">Jugar a STOP</a>
            <a href="/blog" className="hover:underline">Leer el blog</a>
            <a href="/contacto" className="hover:underline">Contacto</a>
          </nav>
        </div>
      </div>
    </main>
  );
}
