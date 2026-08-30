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
export type StopCategory = { id: string; label: string };
export type PlayerResponse = { category: string; word: string };
export type ValidationResult = { player: { response: string; isValid: boolean; score: number } };
export type ValidationResponse = { results: Record<string, ValidationResult>; playerTotalScore: number };
export type DailyChallenge = { letter: string; categories: string[]; date: string; completed?: boolean };

export function normalizeWord(value: string): string {
  return value.toLowerCase().trim().replace(/ñ/g, "~").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z~\s]/g, "").replace(/\s+/g, " ").replace(/~/g, "ñ").trim();
}

export function chooseLetter(random = Math.random): string {
  return STOP_ALPHABET[Math.floor(random() * STOP_ALPHABET.length)];
}

/** Only confirmed client-side timings. Unconfirmed mode rules must not be guessed here. */
export function getModeDuration(mode: StopMode): number {
  switch (mode) {
    case "rapido": return 30;
    case "normal":
    case "diario": return 60;
    case "caos": return 60;
    case "random": throw new Error("La duración de STOP Random debe proceder de la regla oficial del modo.");
  }
}

export function buildValidationRequest(letter: string, language: string, answers: Record<string, string>, categories: StopCategory[] = STOP_CATEGORIES) {
  return { letter, language, playerResponses: categories.map(({ id }) => ({ category: id, word: answers[id] ?? "" })) };
}

function headers(authToken?: string): HeadersInit {
  const value: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (authToken) value["x-stop-token"] = authToken;
  return value;
}

export async function validateRound(apiBaseUrl: string, request: ReturnType<typeof buildValidationRequest>, signal?: AbortSignal, authToken?: string): Promise<ValidationResponse> {
  const response = await fetch(`${apiBaseUrl}/api/game/validate`, { method: "POST", headers: headers(authToken), body: JSON.stringify(request), signal });
  if (!response.ok) throw new Error(`La validación de la partida ha fallado (${response.status}).`);
  return (await response.json()) as ValidationResponse;
}

export async function getDailyChallenge(apiBaseUrl: string, language: string, signal?: AbortSignal, authToken?: string): Promise<DailyChallenge> {
  const response = await fetch(`${apiBaseUrl}/api/daily?language=${encodeURIComponent(language)}`, { signal, headers: headers(authToken) });
  if (!response.ok) throw new Error(`No se ha podido cargar el reto diario (${response.status}).`);
  return (await response.json()) as DailyChallenge;
}
