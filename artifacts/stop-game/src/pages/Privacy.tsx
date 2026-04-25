export default function Privacy() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] text-white px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-black mb-2 text-[hsl(48,96%,57%)]">Política de Privacidad</h1>
      <p className="text-white/50 text-sm mb-8">Última actualización: marzo 2026</p>

      <section className="space-y-6 text-white/80 leading-relaxed">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">1. Información que recopilamos</h2>
          <p>Cuando inicias sesión con Google, Facebook, Instagram o TikTok, recopilamos únicamente tu nombre público y foto de perfil para personalizar tu experiencia en el juego y mostrar tu nombre en el ranking global.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">2. Cómo usamos tu información</h2>
          <p>Usamos tu nombre e imagen exclusivamente dentro del juego: mostrar tu perfil durante las partidas y en la tabla de clasificación. No compartimos tu información con terceros ni la usamos con fines comerciales.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">3. Almacenamiento de datos</h2>
          <p>Tu información de sesión se almacena de forma segura en nuestra base de datos. No almacenamos contraseñas ni tokens de acceso a largo plazo.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">4. Eliminación de datos</h2>
          <p>Puedes solicitar la eliminación completa de tu cuenta y todos tus datos en cualquier momento. Para ello, envía un correo electrónico a <a href="mailto:stopeljuegodepalabras@gmail.com" className="text-[hsl(48,96%,57%)] underline">stopeljuegodepalabras@gmail.com</a> con el asunto <strong>"Eliminar mis datos"</strong> indicando el nombre de usuario o correo con el que iniciaste sesión. Procesaremos tu solicitud en un plazo máximo de 30 días. Se eliminarán: tu nombre, foto de perfil, puntuaciones, historial de partidas y datos de suscripción.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">5. Contacto</h2>
          <p>Para cualquier consulta sobre privacidad o para ejercer tus derechos de acceso, rectificación o eliminación, contacta con nosotros en: <a href="mailto:stopeljuegodepalabras@gmail.com" className="text-[hsl(48,96%,57%)] underline">stopeljuegodepalabras@gmail.com</a></p>
        </div>
      </section>

      <div className="mt-10 p-6 rounded-2xl border border-[hsl(48,96%,57%)]/30 bg-[hsl(48,96%,57%)]/5">
        <h3 className="text-lg font-black text-[hsl(48,96%,57%)] mb-2">🗑️ Solicitar eliminación de cuenta y datos</h3>
        <p className="text-white/70 text-sm mb-4">Tienes una página dedicada con un formulario y todos los detalles del proceso:</p>
        <a
          href="/eliminar-cuenta"
          className="inline-block px-6 py-3 rounded-xl font-black text-sm"
          style={{ background: "hsl(48,96%,57%)", color: "hsl(222,47%,11%)" }}
        >
          Ir a "Eliminar mi cuenta"
        </a>
        <p className="text-white/50 text-xs mt-3">
          También puedes escribirnos directamente a{" "}
          <a href="mailto:stopeljuegodepalabras@gmail.com" className="text-[hsl(48,96%,57%)] underline">
            stopeljuegodepalabras@gmail.com
          </a>{" "}
          con el asunto "Eliminar mis datos".
        </p>
      </div>

      <a href="/" className="inline-block mt-8 text-[hsl(48,96%,57%)] hover:underline">← Volver al juego</a>
    </div>
  );
}
