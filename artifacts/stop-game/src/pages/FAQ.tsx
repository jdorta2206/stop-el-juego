import { Layout } from "@/components/Layout";

export default function FAQ() {
  const faqs = [
    {
      q: "¿Es gratis jugar a STOP?",
      a: "Sí, STOP es completamente gratuito. Puedes jugar todas las partidas que quieras sin pagar nada. Ofrecemos packs opcionales (Premium y Mundial) para quienes quieran apoyar el desarrollo y obtener cosméticos exclusivos.",
    },
    {
      q: "¿Cómo puedo registrarme?",
      a: "Puedes registrarte con tu cuenta de Google, Facebook, Instagram, TikTok o como invitado. El registro es rápido y solo requiere un nombre de usuario y un correo electrónico.",
    },
    {
      q: "¿Qué necesito para jugar?",
      a: "Solo necesitas un navegador web moderno (Chrome, Firefox, Safari, Edge) y conexión a Internet. También puedes instalar la app como PWA en tu dispositivo móvil para una experiencia más nativa.",
    },
    {
      q: "¿Cómo funcionan las monedas?",
      a: "Ganas monedas al final de cada partida en función de tu puntuación. También puedes obtener monedas con el Pack Premium o participando en eventos especiales. Las monedas se gastan en la tienda para comprar cosméticos.",
    },
    {
      q: "¿Qué son los cosméticos?",
      a: "Los cosméticos son elementos decorativos que personalizan tu perfil: avatares, marcos, fondos y títulos. No afectan a la jugabilidad, pero te permiten destacar y mostrar tu estilo.",
    },
    {
      q: "¿Cómo funciona el sistema de experiencia y niveles?",
      a: "Ganas experiencia (XP) en cada partida. Al acumular suficiente XP, subes de nivel. Cada nivel desbloquea nuevas recompensas y cosméticos. Los niveles también influyen en tu posición en el ranking.",
    },
    {
      q: "¿Qué es el Pack Mundial?",
      a: "El Pack Mundial es un pack de pago único que incluye 27 cosméticos exclusivos relacionados con el fútbol y el Mundial (avatares de banderas, balones, marcos, fondos). Es la manera más rápida de tener una colección completa y apoyar el juego.",
    },
    {
      q: "¿Puedo jugar con amigos?",
      a: "Sí, puedes crear salas privadas y compartir el código con tus amigos. También puedes seguir a otros jugadores y ver su actividad en el ranking de amigos.",
    },
    {
      q: "¿Hay límite de jugadores por sala?",
      a: "Las salas multijugador tienen un límite de 8 jugadores. Esto asegura partidas dinámicas y sin esperas excesivas.",
    },
    {
      q: "¿Cómo puedo contactar con soporte?",
      a: "Puedes contactarnos a través de nuestra página de contacto o enviando un correo a dorynex@stopjuegodepalabras.com.",
    },
    {
      q: "¿Puedo jugar sin conexión?",
      a: "No, STOP requiere conexión a Internet para funcionar. Las partidas se sincronizan en tiempo real con el servidor para garantizar una experiencia justa y sin trampas.",
    },
    {
      q: "¿Cómo se puntúa en STOP?",
      a: "Cada respuesta válida y original suma 10 puntos. Si usas el poder de STOP, obtienes +5 puntos. El espía cuesta 10 puntos. En multijugador, las puntuaciones se multiplican por 1.5 al finalizar la partida.",
    },
    {
      q: "¿Qué son los modos de juego?",
      a: "STOP tiene varios modos: Solo (contra IA), Multijugador (en tiempo real), Reto Diario (un desafío único cada día) y Blitz (partidas rápidas de 30 segundos).",
    },
    {
      q: "¿Qué es el Pack Premium?",
      a: "Es una suscripción mensual que elimina anuncios, duplica las monedas ganadas, otorga un 10% extra de experiencia y desbloquea cosméticos exclusivos. Cuesta 1,99 € al mes.",
    },
    {
      q: "¿Puedo jugar en inglés?",
      a: "Sí, STOP está disponible en español, inglés, portugués y francés. Puedes cambiar el idioma en el selector de idioma del menú.",
    },
    {
      q: "¿Qué pasa si pierdo mi progreso?",
      a: "Tu progreso está asociado a tu cuenta. Si inicias sesión en otro dispositivo, tu ranking, monedas y cosméticos estarán disponibles.",
    },
    {
      q: "¿Cómo puedo mejorar mi vocabulario con STOP?",
      a: "Jugando regularmente, prestando atención a las palabras de otros jugadores, y practicando con letras difíciles. También puedes leer nuestros artículos del blog para aprender nuevas palabras.",
    },
    {
      q: "¿STOP tiene trampas?",
      a: "No. Todas las partidas son validadas por el servidor. Las palabras se verifican automáticamente y las respuestas repetidas no suman puntos.",
    },
    {
      q: "¿Cómo funcionan los torneos?",
      a: "Próximamente. Los torneos serán eventos especiales con inscripción previa y partidas eliminatorias. Los ganadores recibirán premios exclusivos.",
    },
    {
      q: "¿Puedo cambiar mi nombre de usuario?",
      a: "Sí, puedes cambiar tu nombre en el perfil. Solo tienes que ir a tu perfil, editar el nombre y guardar.",
    },
  ];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-black text-white mb-6">Preguntas frecuentes (FAQ)</h1>
        <p className="text-white/70 mb-8">
          Encuentra respuestas a las preguntas más comunes sobre STOP. Si no encuentras lo que buscas, contáctanos.
        </p>
        <div className="space-y-4">
          {faqs.map((item, index) => (
            <div key={index} className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <h3 className="text-white font-bold text-lg mb-2">{item.q}</h3>
              <p className="text-white/70">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
