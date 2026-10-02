import { Layout } from "@/components/Layout";

export default function Privacy() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-6">Política de privacidad</h1>
        <div className="text-white/80 leading-relaxed space-y-4">
          <p><strong>Última actualización:</strong> 1 de octubre de 2026</p>
          <p>En STOP valoramos tu privacidad. Esta política explica qué información tratamos, para qué la usamos y con qué servicios puede compartirse.</p>

          <h2 className="text-2xl font-bold text-white mt-6">1. Información que recopilamos</h2>
          <p>Podemos tratar tu nombre de usuario, correo electrónico cuando el proveedor de inicio de sesión lo facilita, foto de perfil, datos de partidas, puntuaciones, progreso, preferencias y datos necesarios para mantener tu sesión y tu cuenta.</p>
          <p>También registramos eventos de uso del juego para medir funcionamiento y actividad. Estos eventos pueden incluir un identificador de jugador, identificador de sesión, idioma, plataforma, modo de juego y datos técnicos o de contexto asociados al evento.</p>

          <h2 className="text-2xl font-bold text-white mt-6">2. Uso de la información</h2>
          <p>Usamos la información para:</p>
          <ul className="list-disc list-inside pl-4">
            <li>Gestionar tu cuenta, sesión, perfil, partidas, ranking y progreso.</li>
            <li>Procesar pagos y suscripciones a través de Stripe o Google Play.</li>
            <li>Enviar notificaciones si las activas.</li>
            <li>Medir y mejorar el funcionamiento, seguridad y experiencia del juego.</li>
            <li>Mostrar publicidad cuando corresponda al servicio que estés utilizando.</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mt-6">3. Analítica, publicidad y cookies</h2>
          <p>La versión web carga servicios de Google Analytics y Google Tag Manager para analítica y puede cargar Google AdSense para publicidad. La aplicación Android/TWA puede utilizar servicios de publicidad y medición asociados a Google Play y AdMob.</p>
          <p>Estos servicios pueden utilizar cookies, identificadores u otras tecnologías de medición según su propia configuración y políticas. Por ello, la versión anterior de esta política que indicaba que no utilizábamos seguimiento de terceros ya no describía correctamente el funcionamiento actual.</p>

          <h2 className="text-2xl font-bold text-white mt-6">4. Terceros</h2>
          <p>Podemos utilizar servicios de Google para autenticación, analítica, publicidad, notificaciones y distribución en Google Play, y Stripe para pagos. Estos proveedores procesan los datos de acuerdo con sus propias condiciones y políticas de privacidad. No vendemos tus datos personales.</p>

          <h2 className="text-2xl font-bold text-white mt-6">5. Tus derechos y eliminación de cuenta</h2>
          <p>Puedes solicitar el acceso, rectificación o eliminación de tus datos escribiendo a <a href="mailto:dorynex@stopjuegodepalabras.com" className="text-secondary hover:underline">dorynex@stopjuegodepalabras.com</a>. También puedes consultar la página de <a href="/eliminar-cuenta" className="text-secondary hover:underline">eliminación de cuenta</a> para enviar una solicitud específica.</p>

          <p className="mt-4 text-sm text-white/40">Si tienes dudas, contáctanos en <a href="/contacto" className="text-secondary hover:underline">nuestra página de contacto</a>.</p>
        </div>
      </div>
    </Layout>
  );
}
