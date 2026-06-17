import { Layout } from "@/components/Layout";

export default function Privacy() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-6">Política de privacidad</h1>
        <div className="text-white/80 leading-relaxed space-y-4">
          <p><strong>Última actualización:</strong> 17 de junio de 2026</p>
          <p>En STOP valoramos tu privacidad. Esta política explica cómo recopilamos, usamos y protegemos tu información.</p>
          <h2 className="text-2xl font-bold text-white mt-6">1. Información que recopilamos</h2>
          <p>Recopilamos tu nombre de usuario, correo electrónico (si inicias sesión con Google u otra red social), y las partidas que juegas para mostrar el ranking y tu progreso.</p>
          <h2 className="text-2xl font-bold text-white mt-6">2. Uso de la información</h2>
          <p>Usamos tu información para:</p>
          <ul className="list-disc list-inside pl-4">
            <li>Mostrar tu perfil y ranking.</li>
            <li>Procesar pagos (a través de Stripe o Google Play).</li>
            <li>Enviarte notificaciones si las activas.</li>
            <li>Mejorar el juego y la experiencia de usuario.</li>
          </ul>
          <h2 className="text-2xl font-bold text-white mt-6">3. Cookies</h2>
          <p>Usamos cookies para recordar tu sesión y preferencias. No usamos cookies de seguimiento de terceros.</p>
          <h2 className="text-2xl font-bold text-white mt-6">4. Terceros</h2>
          <p>Compartimos datos mínimos con Stripe (para pagos) y Google (para autenticación y notificaciones). No vendemos tus datos.</p>
          <h2 className="text-2xl font-bold text-white mt-6">5. Tus derechos</h2>
          <p>Puedes solicitar la eliminación de tus datos escribiendo a <a href="mailto:dorynex@stopjuegodepalabras.com" className="text-secondary hover:underline">dorynex@stopjuegodepalabras.com</a>.</p>
          <p className="mt-4 text-sm text-white/40">Si tienes dudas, contáctanos en <a href="/contacto" className="text-secondary hover:underline">nuestra página de contacto</a>.</p>
        </div>
      </div>
    </Layout>
  );
}
