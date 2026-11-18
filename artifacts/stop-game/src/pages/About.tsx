import { Layout } from "@/components/Layout";

export default function About() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-6">Acerca de STOP El Juego</h1>
        <div className="space-y-6 text-white/80 leading-relaxed">
          <p>
            <strong>STOP El Juego</strong> es un proyecto independiente inspirado en los juegos de categorías y palabras. La propuesta consiste en encontrar respuestas que empiecen por una letra y encajen en distintas categorías, dentro del tiempo de cada ronda.
          </p>
          <h2 className="text-2xl font-bold text-white mt-6">Qué puedes encontrar</h2>
          <p>
            La plataforma ofrece partidas individuales contra la inteligencia artificial y opciones de juego multijugador. La modalidad, las categorías y las condiciones de cada ronda se muestran antes o durante la partida, por lo que pueden variar según el modo elegido.
          </p>
          <p>
            También publicamos guías y artículos sobre reglas, vocabulario y estrategias para ayudar a conocer mejor el juego y practicar con distintas letras.
          </p>
          <h2 className="text-2xl font-bold text-white mt-6">Desarrollo del proyecto</h2>
          <p>
            STOP El Juego se mantiene como un proyecto independiente. Trabajamos en corregir problemas y mejorar la claridad de las instrucciones, la estabilidad de las partidas y la experiencia de uso desde móviles y ordenadores.
          </p>
          <h2 className="text-2xl font-bold text-white mt-6">Contacto</h2>
          <p>
            Para enviar sugerencias, hacer una consulta o comunicar una incidencia, puedes escribir a <a href="mailto:dorynex@stopjuegodepalabras.com" className="text-secondary hover:underline">dorynex@stopjuegodepalabras.com</a> o utilizar el <a href="/contacto" className="text-secondary hover:underline">formulario de contacto</a>.
          </p>
          <p className="text-sm text-white/40 mt-8">
            STOP El Juego es un proyecto independiente y no está afiliado a los titulares de las marcas de terceros que puedan mencionarse en sus contenidos.
          </p>
        </div>
      </div>
    </Layout>
  );
}
