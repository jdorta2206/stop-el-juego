import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui";
import { Mail, Phone, MapPin, Twitter, Instagram, Facebook, CheckCircle, AlertCircle } from "lucide-react";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al enviar el mensaje");
      }
      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
      setTimeout(() => setStatus("idle"), 5000);
    } catch (error: any) {
      setStatus("error");
      setErrorMsg(error.message || "Hubo un problema. Inténtalo de nuevo.");
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-6">Contacto</h1>
        <p className="text-white/70 mb-8">
          ¿Preguntas, sugerencias, problemas técnicos o simplemente quieres saludar?
          Escríbenos y te responderemos lo antes posible.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Formulario */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-white/70 mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white/70 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white/70 mb-1">Mensaje</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              <Button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-secondary text-black font-bold disabled:opacity-50"
              >
                {status === "loading" ? "Enviando..." : "Enviar mensaje"}
              </Button>
              {status === "success" && (
                <div className="flex items-center gap-2 text-green-400 text-sm mt-2">
                  <CheckCircle className="w-4 h-4" /> ¡Mensaje enviado con éxito!
                </div>
              )}
              {status === "error" && (
                <div className="flex items-center gap-2 text-red-400 text-sm mt-2">
                  <AlertCircle className="w-4 h-4" /> {errorMsg}
                </div>
              )}
            </form>
          </div>

          {/* Información de contacto (sin cambios) */}
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-5 h-5 text-secondary" />
                <span className="text-white font-bold">dorynex@stopjuegodepalabras.com</span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <Phone className="w-5 h-5 text-secondary" />
                <span className="text-white">+34 666 66 66 66</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-secondary" />
                <span className="text-white">Leganés, Madrid, España</span>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <p className="text-white/70 text-sm">
                También puedes contactarnos a través de nuestras redes sociales:
              </p>
              <div className="flex gap-4 mt-3">
                <a href="#" className="text-white/70 hover:text-white transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="text-white/70 hover:text-white transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="#" className="text-white/70 hover:text-white transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
