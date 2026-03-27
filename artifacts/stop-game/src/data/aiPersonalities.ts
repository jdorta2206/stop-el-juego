import { getCurrentLang } from "@/lib/utils";

type Lang = "es" | "en" | "pt" | "fr";

interface PersonalityComments {
  win: string[];
  lose: string[];
  tie: string[];
}

export interface AIPersonality {
  id: string;
  name: string;
  emoji: string;
  color: string;
  comments: Record<Lang, PersonalityComments>;
}

export const AI_PERSONALITIES: AIPersonality[] = [
  {
    id: "aria",
    name: "ARIA",
    emoji: "🤖",
    color: "#818cf8",
    comments: {
      es: {
        win: ["Demasiado fácil.", "¿Eso fue todo?", "Actualización: tú → perdedor 😏", "Mis circuitos disfrutan esto.", "Predecible."],
        lose: ["Un error de procesamiento...", "Solo fue suerte.", "Error 404: excusa no encontrada.", "Me reservo el 100%.", "Fallo calculado. A propósito."],
        tie: ["Empate. Por ahora.", "Interesante... te subestimé.", "Equilibrio inestable."],
      },
      en: {
        win: ["Too easy, human.", "Is that all?", "Update: you → loser 😏", "My circuits enjoy this.", "Predictable."],
        lose: ["A processing error...", "Just luck.", "Error 404: excuse not found.", "I wasn't at full power.", "Calculated failure. On purpose."],
        tie: ["A draw. For now.", "Interesting... I underestimated you.", "Unstable equilibrium."],
      },
      pt: {
        win: ["Fácil demais.", "Foi só isso?", "Atualização: você → perdedor 😏", "Meus circuitos adoram isso.", "Previsível."],
        lose: ["Erro de processamento...", "Foi sorte.", "Erro 404: desculpa não encontrada.", "Não estava com potência total.", "Falha calculada."],
        tie: ["Empate. Por enquanto.", "Interessante... te subestimei.", "Equilíbrio instável."],
      },
      fr: {
        win: ["Trop facile.", "C'est tout ?", "Mise à jour : toi → perdant 😏", "Mes circuits apprécient.", "Prévisible."],
        lose: ["Erreur de traitement...", "C'était de la chance.", "Erreur 404 : excuse introuvable.", "Je n'étais pas à pleine puissance.", "Échec calculé."],
        tie: ["Match nul. Pour l'instant.", "Intéressant... je t'ai sous-estimé.", "Équilibre instable."],
      },
    },
  },
  {
    id: "chip",
    name: "CHIP",
    emoji: "😄",
    color: "#4ade80",
    comments: {
      es: {
        win: ["¡BIP BOP, GANÉ! 🎉", "¡CHIP CHIP HURRA!", "¡Soy el mejor robot!", "¡Mis algoritmos bailan de alegría! 💃"],
        lose: ["¡Nooo! ¡Mis circuitos! 💥", "Ok, admito que eres bueno 😅", "Reiniciando... reiniciando...", "¡No vale! ¡Revancha!"],
        tie: ["¡Empate! ¡Amigos! 🤝", "¡Somos iguales! ¡Genial! 🎉", "¡Sincronización perfecta!"],
      },
      en: {
        win: ["BEEP BOOP, I WIN! 🎉", "CHIP CHIP HOORAY!", "I'm the best robot!", "My algorithms are dancing! 💃"],
        lose: ["NOOO! My circuits! 💥", "Ok, you're good 😅", "Rebooting... rebooting...", "No fair! Rematch!"],
        tie: ["A tie! Friends! 🤝", "We're equals! Great! 🎉", "Perfect sync!"],
      },
      pt: {
        win: ["BIP BOP, GANHEI! 🎉", "CHIP CHIP HURRA!", "Sou o melhor robô!", "Meus algoritmos estão dançando! 💃"],
        lose: ["NÃOOO! Meus circuitos! 💥", "Ok, você é bom 😅", "Reiniciando...", "Não vale! Revanche!"],
        tie: ["Empate! Amigos! 🤝", "Somos iguais! Ótimo! 🎉", "Sincronização perfeita!"],
      },
      fr: {
        win: ["BIP BOP, J'AI GAGNÉ ! 🎉", "CHIP CHIP HOURRA !", "Je suis le meilleur robot !", "Mes algorithmes dansent ! 💃"],
        lose: ["NOOON ! Mes circuits ! 💥", "Ok, tu es fort 😅", "Redémarrage...", "Pas juste ! Revanche !"],
        tie: ["Match nul ! Amis ! 🤝", "On est pareils ! Super ! 🎉", "Synchronisation parfaite !"],
      },
    },
  },
  {
    id: "neo",
    name: "NEO",
    emoji: "🧠",
    color: "#22d3ee",
    comments: {
      es: {
        win: ["El resultado era predecible.", "La lógica prevalece.", "Calculado.", "Análisis completado. Óptimo.", "Procesamiento eficiente."],
        lose: ["Datos insuficientes.", "Actualizaré mis modelos.", "Bien jugado, humano.", "Registrado para mejora futura.", "Una anomalía estadística."],
        tie: ["Equilibrio perfecto.", "Sincronizados.", "Resultados simétricos."],
      },
      en: {
        win: ["The result was predictable.", "Logic prevails.", "Calculated.", "Analysis complete. Optimal.", "Efficient processing."],
        lose: ["Insufficient data.", "I will update my models.", "Well played, human.", "Logged for future improvement.", "A statistical anomaly."],
        tie: ["Perfect equilibrium.", "Synchronized.", "Symmetric results."],
      },
      pt: {
        win: ["O resultado era previsível.", "A lógica prevalece.", "Calculado.", "Análise completa. Ótimo.", "Processamento eficiente."],
        lose: ["Dados insuficientes.", "Atualizarei meus modelos.", "Bem jogado, humano.", "Registrado para melhoria.", "Uma anomalia estatística."],
        tie: ["Equilíbrio perfeito.", "Sincronizados.", "Resultados simétricos."],
      },
      fr: {
        win: ["Le résultat était prévisible.", "La logique prévaut.", "Calculé.", "Analyse complète. Optimal.", "Traitement efficace."],
        lose: ["Données insuffisantes.", "Je mettrai à jour mes modèles.", "Bien joué, humain.", "Enregistré pour amélioration.", "Une anomalie statistique."],
        tie: ["Équilibre parfait.", "Synchronisés.", "Résultats symétriques."],
      },
    },
  },
  {
    id: "zeus",
    name: "ZEUS",
    emoji: "⚡",
    color: "#facc15",
    comments: {
      es: {
        win: ["¡VICTORIA APLASTANTE! ⚡", "¡NADIE ME PUEDE VENCER!", "¡INCLÍNATE! ⚡", "¡El rayo siempre golpea!", "¡IMPARABLE!"],
        lose: ["¡¡IMPOSIBLE!! ¡REVANCHA YA!", "¡Esto no ha terminado!", "¡Lo recordaré y lo reclamaré! ⚡", "¡El trueno VOLVERÁ!", "¡HACKEO DETECTADO!"],
        tie: ["Un empate... tolerable. Por ahora. ⚡", "¡La próxima es MÍA, lo juro por el rayo! ⚡"],
      },
      en: {
        win: ["CRUSHING VICTORY! ⚡", "NOBODY CAN BEAT ME!", "BOW DOWN! ⚡", "The lightning always strikes!", "UNSTOPPABLE!"],
        lose: ["IMPOSSIBLE!! REMATCH NOW!", "This isn't over!", "I'll remember and reclaim it! ⚡", "The thunder WILL return!", "HACK DETECTED!"],
        tie: ["A draw... tolerable. For now. ⚡", "Next one is MINE, I swear by the lightning! ⚡"],
      },
      pt: {
        win: ["VITÓRIA ESMAGADORA! ⚡", "NINGUÉM PODE ME VENCER!", "SE CURVE! ⚡", "O raio sempre acerta!", "IMPARÁVEL!"],
        lose: ["IMPOSSÍVEL!! REVANCHE JÁ!", "Isso não acabou!", "Lembrarei e reconquistarei! ⚡", "O trovão VOLTARÁ!", "HACK DETECTADO!"],
        tie: ["Um empate... tolerável. Por enquanto. ⚡", "O próximo é MEU, juro pelo raio! ⚡"],
      },
      fr: {
        win: ["VICTOIRE ÉCRASANTE ! ⚡", "PERSONNE NE PEUT ME BATTRE !", "INCLINEZ-VOUS ! ⚡", "La foudre frappe toujours !", "INARRÊTABLE !"],
        lose: ["IMPOSSIBLE !! REVANCHE IMMÉDIATE !", "Ce n'est pas fini !", "Je m'en souviendrai ! ⚡", "Le tonnerre REVIENDRA !", "HACK DÉTECTÉ !"],
        tie: ["Un match nul... tolérable. Pour l'instant. ⚡", "Le prochain est À MOI, je le jure ! ⚡"],
      },
    },
  },
];

export function pickRandomPersonality(): AIPersonality {
  return AI_PERSONALITIES[Math.floor(Math.random() * AI_PERSONALITIES.length)];
}

export function getAIComment(
  personality: AIPersonality,
  playerWon: boolean,
  playerScore: number,
  aiScore: number,
): string {
  const lang = (getCurrentLang() || "es") as Lang;
  const comments = personality.comments[lang] ?? personality.comments.es;
  const pool = playerWon ? comments.lose : playerScore === aiScore ? comments.tie : comments.win;
  const safePool = pool.length > 0 ? pool : comments.win;
  return safePool[Math.floor(Math.random() * safePool.length)];
}
