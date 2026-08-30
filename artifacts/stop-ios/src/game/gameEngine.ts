export const STOP_ALPHABET = ["A","B","C","D","E","F","G","H","I","J","L","M","N","O","P","Q","R","S","T","U","V","X","Y","Z"] as const;

export const STOP_CATEGORIES = [
  { id: "nombre", label: "Nombre" },
  { id: "lugar", label: "Lugar" },
  { id: "animal", label: "Animal" },
  { id: "objeto", label: "Objeto" },
  { id: "color", label: "Color" },
  { id: "fruta", label: "Fruta" },
  { id: "marca", label: "Marca" },
] as const;

export type StopMode = "normal" | "rapido" | "caos" | "random" | "diario";

export const STOP_MODE_CONFIG: Record<StopMode, { duration: number; label: string }> = {
  normal: { duration: 60, label: "Normal" },
  rapido: { duration: 30, label: "Rápido" },
  caos: { duration: 60, label: "Caos" },
  random: { duration: 60, label: "Random" },
  diario: { duration: 60, label: "Reto Diario" },
};

export type PlayerResponse = { category: string; word: string };

export type ValidationResult = {
  player: { response: string; isValid: boolean; score: number };
  ai: { response: string; isValid: boolean; score: number };
};

export type ValidationResponse = {
  results: Record<string, ValidationResult>;
  playerTotalScore: number;
  aiTotalScore: number;
};

export function normalizeWord(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/ñ/g, "~")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z~\s]/g, "")
    .replace(/\s+/g, " ")
    .replace(/~/g, "ñ")
    .trim();
}

export function chooseLetter(random = Math.random): string {
  return STOP_ALPHABET[Math.floor(random() * STOP_ALPHABET.length)];
}

export function getModeDuration(mode: StopMode, random = Math.random): number {
  if (mode !== "random") return STOP_MODE_CONFIG[mode].duration;
  // Random is intentionally bounded; the exact scoring/validation remains server-side.
  return [30, 45, 60, 75, 90][Math.floor(random() * 5)];
}

export function buildValidationRequest(
  letter: string,
  language: string,
  answers: Record<string, string>,
): { letter: string; language: string; playerResponses: PlayerResponse[] } {
  return {
    letter,
    language,
    playerResponses: STOP_CATEGORIES.map(({ id }) => ({
      category: id,
      word: answers[id] ?? "",
    })),
  };
}

export async function validateRound(
  apiBaseUrl: string,
  request: ReturnType<typeof buildValidationRequest>,
  signal?: AbortSignal,
): Promise<ValidationResponse> {
  const response = await fetch(`${apiBaseUrl}/api/game/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw new Error(`La validación de la partida ha fallado (${response.status}).`);
  }

  return (await response.json()) as ValidationResponse;
}
