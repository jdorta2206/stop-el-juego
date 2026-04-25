import { useState } from "react";

export default function DeleteAccount() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent("Eliminar mis datos — STOP! Juego de Palabras");
    const body = encodeURIComponent(
      `Hola,\n\nQuiero eliminar mi cuenta y todos mis datos del juego STOP.\n\n` +
      `Email / nombre de usuario: ${email}\n\n` +
      `Motivo (opcional): ${reason}\n\n` +
      `Confirmo que entiendo que esta acción es irreversible.\n\nGracias.`
    );
    window.location.href = `mailto:stopeljuegodepalabras@gmail.com?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] text-white px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-black mb-2 text-[hsl(48,96%,57%)]">
          🗑️ Eliminar cuenta y datos
        </h1>
        <p className="text-white/50 text-sm mb-2">STOP! Juego de Palabras Online</p>
        <p className="text-white/60 mb-8">
          Desarrollador: <strong>Dorynex</strong> · Contacto:{" "}
          <a href="mailto:stopeljuegodepalabras@gmail.com" className="text-[hsl(48,96%,57%)] underline">
            stopeljuegodepalabras@gmail.com
          </a>
        </p>

        <section className="space-y-6 text-white/80 leading-relaxed mb-10">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">¿Qué se eliminará?</h2>
            <p className="mb-3">Si solicitas la eliminación, borraremos de forma permanente los siguientes datos asociados a tu cuenta:</p>
            <ul className="list-disc pl-6 space-y-1 text-white/70">
              <li>Tu nombre de usuario y foto de perfil</li>
              <li>Tu correo electrónico vinculado al inicio de sesión (Google, Facebook, Instagram o TikTok)</li>
              <li>Tu puntuación y posición en el ranking global</li>
              <li>Tu historial de partidas y estadísticas</li>
              <li>Tu lista de amigos y solicitudes pendientes</li>
              <li>Tus preferencias de notificaciones y configuración</li>
              <li>Tu suscripción Premium activa (si la tienes — la cancelaremos antes de borrar)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-2">¿Qué se conservará y por qué?</h2>
            <p className="text-white/70">
              Por obligaciones legales (facturación, prevención de fraude), conservamos durante un máximo de <strong>5 años</strong> los registros financieros anonimizados de las suscripciones (sin tu nombre, email ni datos personales). Esto se exige por la ley fiscal española y europea.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-2">Plazo de eliminación</h2>
            <p className="text-white/70">
              Procesamos todas las solicitudes en un plazo máximo de <strong>30 días</strong> desde la recepción de tu correo. Recibirás un email de confirmación cuando tu cuenta haya sido eliminada.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-2">¿Cómo solicitarlo?</h2>
            <p className="text-white/70 mb-3">Tienes 2 opciones equivalentes:</p>
            <ol className="list-decimal pl-6 space-y-2 text-white/70">
              <li>
                <strong>Opción rápida (recomendada):</strong> rellena el formulario de abajo. Se abrirá tu app de correo con el mensaje pre-redactado.
              </li>
              <li>
                <strong>Opción manual:</strong> envía un email a{" "}
                <a href="mailto:stopeljuegodepalabras@gmail.com" className="text-[hsl(48,96%,57%)] underline">
                  stopeljuegodepalabras@gmail.com
                </a>{" "}
                con el asunto <strong>"Eliminar mis datos"</strong> indicando el email o nombre de usuario con el que iniciaste sesión.
              </li>
            </ol>
          </div>
        </section>

        <div className="rounded-2xl border-2 border-[hsl(48,96%,57%)]/40 bg-[hsl(48,96%,57%)]/5 p-6">
          <h3 className="text-lg font-black text-[hsl(48,96%,57%)] mb-4">
            📧 Solicitud de eliminación
          </h3>

          {sent ? (
            <div className="text-white/80">
              <p className="font-semibold mb-2">✅ Tu solicitud está lista para enviar.</p>
              <p className="text-sm text-white/60">
                Si tu app de correo no se abrió automáticamente, copia esta dirección y mándanos un email manualmente:
                <br />
                <a href="mailto:stopeljuegodepalabras@gmail.com" className="text-[hsl(48,96%,57%)] underline">
                  stopeljuegodepalabras@gmail.com
                </a>
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-sm text-[hsl(48,96%,57%)] underline"
              >
                ← Editar la solicitud
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-white/80 mb-1">
                  Tu email o nombre de usuario *
                </label>
                <input
                  id="email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@gmail.com"
                  className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[hsl(48,96%,57%)]"
                />
                <p className="text-xs text-white/50 mt-1">
                  El mismo con el que iniciaste sesión en el juego.
                </p>
              </div>

              <div>
                <label htmlFor="reason" className="block text-sm font-semibold text-white/80 mb-1">
                  Motivo (opcional)
                </label>
                <textarea
                  id="reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Cuéntanos por qué te vas (nos ayuda a mejorar)…"
                  className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[hsl(48,96%,57%)] resize-none"
                />
              </div>

              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-200">
                ⚠️ <strong>Atención:</strong> esta acción es <strong>irreversible</strong>. Una vez procesada, no podremos recuperar tu cuenta, puntuaciones ni amigos.
              </div>

              <button
                type="submit"
                className="w-full px-6 py-4 rounded-xl font-black text-base transition hover:opacity-90"
                style={{ background: "hsl(48,96%,57%)", color: "hsl(222,47%,11%)" }}
              >
                Enviar solicitud de eliminación
              </button>
            </form>
          )}
        </div>

        <div className="mt-10 flex gap-4 text-sm">
          <a href="/" className="text-[hsl(48,96%,57%)] hover:underline">← Volver al juego</a>
          <span className="text-white/30">·</span>
          <a href="/privacy" className="text-[hsl(48,96%,57%)] hover:underline">Política de privacidad</a>
          <span className="text-white/30">·</span>
          <a href="/terms" className="text-[hsl(48,96%,57%)] hover:underline">Términos de uso</a>
        </div>
      </div>
    </div>
  );
}
