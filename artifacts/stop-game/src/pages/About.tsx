import { Layout } from "@/components/Layout";

export default function About() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-6">Acerca de STOP</h1>
        <div className="space-y-6 text-white/80 leading-relaxed">
          <p>
            <strong>STOP El Juego</strong> es un proyecto independiente inspirado en los juegos clásicos de categorías y palabras, conocidos en distintos lugares como STOP, Basta o Tutti Frutti. Su objetivo es ofrecer una forma accesible de jugar desde el navegador y compartir partidas desde móvil u ordenador.
          </p>
          <p>
            El objetivo era sencillo: <strong>conectar a personas a través de la diversión y el desafío mental</strong>. Queríamos que cualquier persona, sin importar su edad o conocimientos informáticos, pudiera disfrutar de una partida rápida con amigos o competir globalmente en retos diarios.
          </p>
          <h2 className="text-2xl font-bold text-white mt-6">¿Quién está detrás de STOP?</h2>
          <p>
            El proyecto se mantiene y mejora de forma continua a partir de las necesidades de la comunidad y de los problemas detectados durante el uso. Las prioridades son la estabilidad de las partidas, la claridad de las reglas y una experiencia accesible.
          </p>
          <p>
            El proyecto se financia principalmente mediante <strong>packs opcionales</strong> (Premium y Mundial) que ofrecen cosméticos exclusivos y apoyan el desarrollo continuo. También estamos explorando la publicidad responsable para mantener el juego gratuito para todos.
          </p>
          <h2 className="text-2xl font-bold text-white mt-6">Nuestra misión</h2>
          <p>
            Queremos que STOP sea el juego de palabras de referencia en español y en otros idiomas. Trabajamos constantemente en:
          </p>
          <ul className="list-disc list-inside pl-4 space-y-1">
            <li>Nuevos modos de juego (torneos, ligas, eventos especiales).</li>
            <li>Más idiomas y soporte multilingüe.</li>
            <li>Mejoras en la interfaz y accesibilidad.</li>
            <li>Una comunidad activa y respetuosa.</li>
          </ul>
          <h2 className="text-2xl font-bold text-white mt-6">¿Por qué jugar a STOP?</h2>
          <p>
            Más allá de la diversión, STOP entrena tu mente. Mejora tu vocabulario, tu rapidez mental, tu memoria y tu capacidad de concentración. Es un juego que puedes disfrutar en cualquier momento: en el autobús, en una pausa del trabajo, o en una tarde con amigos.
          </p>
          <p>
            Además, es completamente gratuito. No necesitas pagar para jugar partidas ilimitadas. Los packs opcionales solo añaden cosméticos y apoyan el proyecto.
          </p>
          <h2 className="text-2xl font-bold text-white mt-6">Contacto</h2>
          <p>
            ¿Tienes ideas, sugerencias o quieres reportar un problema? Escríbenos a <a href="mailto:soporte@stopjuegodepalabras.com" className="text-secondary hover:underline">soporte@stopjuegodepalabras.com</a> o usa nuestro <a href="/contacto" className="text-secondary hover:underline">formulario de contacto</a>.
          </p>
          <p className="text-sm text-white/40 mt-8">
            STOP es un proyecto independiente. No estamos afiliados a Scattergories o Hasbro. Todos los derechos de las marcas mencionadas pertenecen a sus respectivos propietarios.
          </p>
        </div>
      </div>
    </Layout>
  );
}
