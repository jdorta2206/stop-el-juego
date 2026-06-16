import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui";
import { Mail, Phone, MapPin } from "lucide-react";

export default function Contact() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-6">Contacto</h1>
        <p className="text-white/70 mb-8">
          ¿Preguntas, sugerencias o problemas? Escríbenos y te responderemos lo antes posible.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Formulario */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <form className="space-y-4" action="/api/contact" method="POST">
              <div>
                <label className="block text-sm font-bold text-white/70 mb-1">Nombre</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white/70 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white/70 mb-1">Mensaje</label>
                <textarea
                  name="message"
                  rows={4}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-white"
                ></textarea>
              </div>
              <Button type="submit" className="w-full bg-secondary text-black font-bold">
                Enviar mensaje
              </Button>
            </form>
          </div>

          {/* Información de contacto */}
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-5 h-5 text-secondary" />
                <span className="text-white font-bold">jdorta2206@gmail.com</span>
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
                <a href="#" className="text-white/70 hover:text-white">Twitter</a>
                <a href="#" className="text-white/70 hover:text-white">Instagram</a>
                <a href="#" className="text-white/70 hover:text-white">Facebook</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
