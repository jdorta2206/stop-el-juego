export default function Terms() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] text-white px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-black mb-2 text-[hsl(48,96%,57%)]">Términos de Servicio</h1>
      <p className="text-white/50 text-sm mb-8">Última actualización: marzo 2026</p>

      <section className="space-y-6 text-white/80 leading-relaxed">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">1. Aceptación de los términos</h2>
          <p>Al usar STOP El Juego, aceptas estos términos de servicio. Si no estás de acuerdo, por favor no uses la aplicación.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">2. Descripción del servicio</h2>
          <p>STOP El Juego es un juego de palabras (Tutti Frutti / Scattergories) donde los jugadores completan categorías con palabras que empiecen por una letra aleatoria. El juego está disponible en modo individual contra IA y en modo multijugador en tiempo real.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">3. Conducta del usuario</h2>
          <p>Los jugadores deben comportarse de forma respetuosa. No se permite el uso de lenguaje ofensivo, trampas ni comportamientos que arruinen la experiencia de otros jugadores.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">4. Propiedad intelectual</h2>
          <p>Todo el contenido del juego, incluyendo el diseño, código y marca STOP El Juego, está protegido. No puedes reproducir ni distribuir el contenido sin autorización.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">5. Limitación de responsabilidad</h2>
          <p>El juego se proporciona "tal como está". No garantizamos disponibilidad ininterrumpida ni nos hacemos responsables de pérdidas de datos o puntuaciones debidas a fallos técnicos.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">6. Cambios en los términos</h2>
          <p>Nos reservamos el derecho de actualizar estos términos en cualquier momento. Los cambios se publicarán en esta página.</p>
        </div>
      </section>

      <a href="/" className="inline-block mt-10 text-[hsl(48,96%,57%)] hover:underline">← Volver al juego</a>
    </div>
  );
}
