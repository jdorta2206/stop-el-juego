export default function Privacy() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] text-white px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-black mb-2 text-[hsl(48,96%,57%)]">Política de Privacidad</h1>
      <p className="text-white/50 text-sm mb-8">Última actualización: marzo 2026</p>

      <section className="space-y-6 text-white/80 leading-relaxed">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">1. Información que recopilamos</h2>
          <p>Cuando inicias sesión con Google, Facebook o TikTok, recopilamos únicamente tu nombre público y foto de perfil para personalizar tu experiencia en el juego y mostrar tu nombre en el ranking global.</p>
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
          <p>Puedes solicitar la eliminación de tus datos en cualquier momento enviando un correo a través de la sección de contacto. Eliminaremos toda tu información en un plazo de 30 días.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">5. Contacto</h2>
          <p>Para cualquier consulta sobre privacidad, puedes contactarnos a través de la app.</p>
        </div>
      </section>

      <a href="/" className="inline-block mt-10 text-[hsl(48,96%,57%)] hover:underline">← Volver al juego</a>
    </div>
  );
}
