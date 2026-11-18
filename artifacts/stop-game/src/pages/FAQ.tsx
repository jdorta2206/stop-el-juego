import { Layout } from "@/components/Layout";

const faqs = [
  {
    q: "¿Qué es STOP El Juego?",
    a: "Es un juego de palabras por categorías. En cada ronda recibes una letra y debes escribir respuestas que empiecen por ella y encajen en las categorías que aparecen en pantalla.",
  },
  {
    q: "¿Cómo empiezo una partida?",
    a: "Abre el juego, elige una modalidad disponible y sigue las indicaciones de la pantalla. Antes de escribir, comprueba la letra de la ronda y las categorías que debes completar.",
  },
  {
    q: "¿Cuánto dura una ronda?",
    a: "El tiempo depende de la modalidad y de la configuración de la partida. El contador visible durante la ronda es la referencia válida; no todas las modalidades utilizan la misma duración.",
  },
  {
    q: "¿Qué ocurre cuando pulso STOP?",
    a: "En las modalidades que permiten detener la ronda, el control STOP cierra el tiempo de respuesta. Si nadie la termina antes, la ronda se cierra cuando llega a cero. Sigue siempre el comportamiento que indique el modo elegido.",
  },
  {
    q: "¿Qué hace que una respuesta sea válida?",
    a: "Debe empezar por la letra de la ronda y corresponder a la categoría solicitada. Si una palabra es dudosa, consulta las reglas de la partida y los criterios que se muestran en el resultado.",
  },
  {
    q: "¿Las respuestas repetidas puntúan igual?",
    a: "La coincidencia con las respuestas de otros participantes puede afectar a la puntuación. El cálculo concreto depende de la modalidad, por lo que el resultado de la partida es la referencia para esa ronda.",
  },
  {
    q: "¿Puedo jugar sin otras personas?",
    a: "Sí. El modo individual permite jugar por tu cuenta contra la inteligencia artificial. También puedes elegir una modalidad multijugador cuando quieras compartir la partida.",
  },
  {
    q: "¿Cómo invito a mis amigos?",
    a: "Entra en el modo multijugador, crea una sala y comparte el código que se muestra. Tus amigos podrán utilizarlo para entrar en esa partida.",
  },
  {
    q: "¿Necesito conexión a Internet?",
    a: "Sí. STOP es un juego online: necesita conexión para cargar la plataforma y utilizar las funciones de partida y sincronización.",
  },
  {
    q: "¿Tengo que crear una cuenta?",
    a: "Puedes acceder como invitado cuando esa opción esté disponible. Iniciar sesión permite utilizar las funciones vinculadas a una cuenta, como conservar el progreso asociado a ella.",
  },
  {
    q: "¿Se puede jugar desde un móvil?",
    a: "Sí. Puedes abrir STOP desde el navegador de un móvil, una tablet o un ordenador. La presentación se adapta al dispositivo.",
  },
  {
    q: "¿Dónde puedo consultar reglas y estrategias?",
    a: "Consulta la guía de cómo jugar para conocer la dinámica de una ronda y visita el blog para leer artículos sobre vocabulario, letras y estrategias.",
  },
  {
    q: "¿Cómo contacto con el equipo?",
    a: "Puedes utilizar el formulario de contacto o escribir a dorynex@stopjuegodepalabras.com. Describe el problema e indica el dispositivo y el navegador; nunca envíes contraseñas ni datos de pago.",
  },
];

export default function FAQ() {
  return (
    <Layout>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-4">Preguntas frecuentes sobre STOP El Juego</h1>
        <p className="text-white/75 leading-relaxed mb-8">
          Respuestas prácticas sobre las rondas, las modalidades, las respuestas, las cuentas y el uso de STOP desde distintos dispositivos.
          Si una función cambia según el modo, sigue las instrucciones que aparecen dentro de la partida.
        </p>
        <div className="space-y-4">
          {faqs.map((item) => (
            <section key={item.q} className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <h2 className="text-white font-bold text-lg mb-2">{item.q}</h2>
              <p className="text-white/75 leading-relaxed">{item.a}</p>
            </section>
          ))}
        </div>
        <nav aria-label="Más información" className="mt-10 flex flex-wrap gap-4 text-secondary">
          <a href="/como-jugar" className="hover:underline">Cómo jugar</a>
          <a href="/como-funciona" className="hover:underline">Cómo funciona</a>
          <a href="/blog" className="hover:underline">Blog</a>
          <a href="/contacto" className="hover:underline">Contacto</a>
        </nav>
      </main>
    </Layout>
  );
}
