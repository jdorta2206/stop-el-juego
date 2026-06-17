import { Layout } from "@/components/Layout";

export default function Terms() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-6">Términos y condiciones</h1>
        <div className="text-white/80 leading-relaxed space-y-4">
          <p><strong>Última actualización:</strong> 17 de junio de 2026</p>
          <p>Al usar STOP aceptas estos términos. Si no estás de acuerdo, no uses el servicio.</p>

          <h2 className="text-2xl font-bold text-white mt-6">1. Uso del servicio</h2>
          <p>STOP es un juego de palabras gratuito para mayores de 13 años. Puedes jugar sin registro, pero algunas funciones (ranking, tienda) requieren cuenta.</p>

          <h2 className="text-2xl font-bold text-white mt-6">2. Cuentas</h2>
          <p>Eres responsable de tu cuenta y de mantener tu contraseña segura. No compartas tu cuenta con terceros.</p>

          <h2 className="text-2xl font-bold text-white mt-6">3. Compras</h2>
          <p>Los packs Premium y Mundial son opcionales y no reembolsables. Los precios se muestran en euros (€).</p>

          <h2 className="text-2xl font-bold text-white mt-6">4. Conducta</h2>
          <p>No está permitido hacer trampas, acosar a otros jugadores o usar lenguaje ofensivo. El incumplimiento puede resultar en la suspensión de la cuenta.</p>

          <h2 className="text-2xl font-bold text-white mt-6">5. Propiedad intelectual</h2>
          <p>Todos los derechos de STOP pertenecen a sus creadores. No puedes copiar, modificar o distribuir el juego sin permiso.</p>

          <h2 className="text-2xl font-bold text-white mt-6">6. Cambios en los términos</h2>
          <p>Podemos actualizar estos términos ocasionalmente. Te notificaremos con antelación.</p>

          <h2 className="text-2xl font-bold text-white mt-6">7. Contacto</h2>
          <p>Para cualquier consulta, contáctanos en <a href="/contacto" className="text-secondary hover:underline">nuestra página de contacto</a> o por correo a <a href="mailto:dorynex@stopjuegodepalabras.com" className="text-secondary hover:underline">dorynex@stopjuegodepalabras.com</a>.</p>
        </div>
      </div>
    </Layout>
  );
}
