import { Layout } from "@/components/Layout";

export default function Privacy() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-6">Política de privacidad</h1>
        <div className="text-white/80 leading-relaxed space-y-4">
          <p><strong>Última actualización:</strong> 18 de noviembre de 2026</p>
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
          <p>La versión web utiliza Google Analytics y Google Tag Manager para analítica y puede cargar Google AdSense para publicidad. La aplicación Android/TWA puede utilizar servicios de publicidad y medición asociados a Google Play y AdMob.</p>
          <p>Estos servicios y sus proveedores pueden utilizar cookies, identificadores, direcciones IP, balizas web u otras tecnologías para medir el uso del servicio, limitar la frecuencia de los anuncios, detectar actividad no válida y, cuando exista el consentimiento requerido, personalizar la publicidad.</p>
          <p>Cuando se muestran anuncios de Google, Google y sus partners pueden utilizar cookies para mostrar anuncios basados en visitas anteriores de este sitio o de otros sitios. También pueden leer o almacenar cookies en el navegador y tratar identificadores u otros datos técnicos relacionados con la publicidad. Otros proveedores o redes publicitarias que participen en la publicación de anuncios pueden utilizar tecnologías similares; sus tratamientos se rigen por sus propias políticas.</p>
          <p>Puedes consultar cómo utiliza Google los datos cuando usas sitios o aplicaciones de sus partners en <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">Cómo utiliza Google los datos</a>. También puedes gestionar la personalización de anuncios desde <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">Configuración de anuncios de Google</a> y consultar opciones de exclusión de otros proveedores en <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">YourAdChoices</a>.</p>
          <p>El uso de cookies y tecnologías no esenciales y el tratamiento de datos para publicidad se gestionan de acuerdo con las opciones de consentimiento que correspondan a tu región y a la configuración de los servicios publicitarios. Puedes consultar o modificar las opciones de privacidad que se te presenten en el mensaje de consentimiento del sitio.</p>

          <h2 className="text-2xl font-bold text-white mt-6">4. Terceros</h2>
          <p>Podemos utilizar servicios de Google para autenticación, analítica, publicidad, notificaciones y distribución en Google Play, y Stripe para pagos. Estos proveedores procesan los datos de acuerdo con sus propias condiciones y políticas de privacidad. No vendemos tus datos personales.</p>

          <h2 className="text-2xl font-bold text-white mt-6">5. Tus derechos y eliminación de cuenta</h2>
          <p>Puedes solicitar el acceso, rectificación o eliminación de tus datos escribiendo a <a href="mailto:dorynex@stopjuegodepalabras.com" className="text-secondary hover:underline">dorynex@stopjuegodepalabras.com</a>. También puedes consultar la página de <a href="/eliminar-cuenta" className="text-secondary hover:underline">eliminación de cuenta</a> para enviar una solicitud específica.</p>

          <h2 className="text-2xl font-bold text-white mt-6">6. Contacto para cuestiones de privacidad</h2>
          <p>Para cualquier consulta sobre esta política o sobre el tratamiento de datos personales, puedes contactar con el responsable del proyecto STOP en <a href="mailto:dorynex@stopjuegodepalabras.com" className="text-secondary hover:underline">dorynex@stopjuegodepalabras.com</a>.</p>
          <p className="mt-4 text-sm text-white/40">También puedes escribirnos a través de <a href="/contacto" className="text-secondary hover:underline">nuestra página de contacto</a>.</p>
        </div>
      </div>
    </Layout>
  );
}
