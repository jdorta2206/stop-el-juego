import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiFetch } from "./api";

const CATEGORIES = ["Nombre", "Lugar", "Animal", "Objeto", "Color", "Fruta", "Marca"] as const;
const ALPHABET_ES = "ABCDEFGHIJKLMNÑOPRSTUVWYZ".split("");
const ROUND_SECONDS = 60;

type Category = (typeof CATEGORIES)[number];
type Answers = Record<Category, string>;
type ValidationResult = {
  results: Record<string, {
    player: { response: string; isValid: boolean; score: number };
    ai: { response: string; isValid: boolean; score: number };
  }>;
  playerTotalScore: number;
  aiTotalScore: number;
};

const emptyAnswers = (): Answers => ({
  Nombre: "", Lugar: "", Animal: "", Objeto: "", Color: "", Fruta: "", Marca: "",
});

function pickLetter(previous?: string) {
  const choices = previous ? ALPHABET_ES.filter((l) => l !== previous) : ALPHABET_ES;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function GameScreen({ onExit }: { onExit: () => void }) {
  const [letter, setLetter] = useState(() => pickLetter());
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [running, setRunning] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const roundComplete = !running || !!result;
  const progress = useMemo(() => secondsLeft / ROUND_SECONDS, [secondsLeft]);

  const finishRound = useCallback(async () => {
    if (submittedRef.current || result) return;
    submittedRef.current = true;
    setRunning(false);
    setSubmitting(true);
    setError(null);

    try {
      const playerResponses = CATEGORIES.map((category) => ({
        category,
        word: answers[category].trim(),
      }));

      const validation = await apiFetch<ValidationResult>("/api/game/validate", {
        method: "POST",
        body: JSON.stringify({
          letter,
          language: "es",
          playerResponses,
        }),
      });
      setResult(validation);
    } catch (e) {
      submittedRef.current = false;
      setError(e instanceof Error ? e.message : "No se ha podido validar la partida.");
    } finally {
      setSubmitting(false);
    }
  }, [answers, letter, result]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          clearInterval(timer);
          void finishRound();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, finishRound]);

  const updateAnswer = (category: Category, word: string) => {
    if (!running) return;
    setAnswers((current) => ({ ...current, [category]: word }));
  };

  const startNewRound = () => {
    setLetter(pickLetter(letter));
    setAnswers(emptyAnswers());
    setSecondsLeft(ROUND_SECONDS);
    setResult(null);
    setError(null);
    submittedRef.current = false;
    setRunning(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={onExit} accessibilityRole="button">
            <Text style={styles.back}>‹ Volver</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>STOP!</Text>
          <Text style={styles.mode}>SOLO</Text>
        </View>

        <View style={styles.letterCard}>
          <Text style={styles.letterLabel}>LETRA</Text>
          <Text style={styles.letter}>{letter}</Text>
          <View style={styles.timerTrack}>
            <View style={[styles.timerFill, { width: `${Math.max(0, progress) * 100}%` }]} />
          </View>
          <Text style={styles.timer}>{secondsLeft}s</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Escribe una palabra por categoría</Text>
          <Text style={styles.infoText}>Todas deben empezar por {letter}. STOP termina la ronda y el servidor valida las respuestas.</Text>
        </View>

        {CATEGORIES.map((category) => {
          const item = result?.results?.[category];
          return (
            <View key={category} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <Text style={styles.category}>{category}</Text>
                {item && <Text style={item.player.isValid ? styles.valid : styles.invalid}>{item.player.isValid ? `+${item.player.score}` : "0"}</Text>}
              </View>
              <TextInput
                value={answers[category]}
                onChangeText={(value) => updateAnswer(category, value)}
                placeholder={`${letter}…`}
                editable={running}
                autoCapitalize="words"
                returnKeyType="next"
                style={[styles.input, item && (item.player.isValid ? styles.inputValid : styles.inputInvalid)]}
              />
              {item && <Text style={styles.aiText}>IA: {item.ai.response || "—"} · {item.ai.score} pts</Text>}
            </View>
          );
        })}

        {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Ronda terminada</Text>
            <Text style={styles.resultScore}>{result.playerTotalScore} puntos</Text>
            <Text style={styles.resultSub}>IA: {result.aiTotalScore} puntos</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={startNewRound}>
              <Text style={styles.primaryText}>Jugar otra ronda</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={() => void finishRound()} disabled={!running || submitting}>
            {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.stopText}>¡STOP!</Text>}
            <Text style={styles.stopHint}>{running ? "Terminar y validar" : "Ronda terminada"}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f8fc" },
  container: { padding: 18, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  back: { color: "#151f63", fontSize: 16, fontWeight: "800" },
  headerTitle: { fontSize: 22, fontWeight: "900" },
  mode: { fontSize: 11, fontWeight: "800", color: "#6b7280" },
  letterCard: { alignItems: "center", backgroundColor: "#151f63", borderRadius: 24, paddingVertical: 20, marginBottom: 12 },
  letterLabel: { color: "white", opacity: 0.7, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  letter: { color: "white", fontSize: 64, lineHeight: 72, fontWeight: "900" },
  timerTrack: { height: 6, width: "80%", backgroundColor: "rgba(255,255,255,.22)", borderRadius: 3, overflow: "hidden", marginTop: 6 },
  timerFill: { height: "100%", backgroundColor: "white", borderRadius: 3 },
  timer: { color: "white", marginTop: 7, fontSize: 14, fontWeight: "800" },
  infoBox: { backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 12 },
  infoTitle: { fontSize: 15, fontWeight: "800" },
  infoText: { marginTop: 4, color: "#666b78", lineHeight: 19, fontSize: 13 },
  categoryCard: { backgroundColor: "white", borderRadius: 16, padding: 12, marginBottom: 9 },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 7 },
  category: { fontSize: 15, fontWeight: "800" },
  valid: { color: "#16803c", fontWeight: "900" },
  invalid: { color: "#b42318", fontWeight: "900" },
  input: { borderWidth: 1, borderColor: "#d9dce6", borderRadius: 11, paddingHorizontal: 13, height: 46, fontSize: 16, backgroundColor: "#fbfcff" },
  inputValid: { borderColor: "#72c58b" },
  inputInvalid: { borderColor: "#e29a94" },
  aiText: { marginTop: 6, color: "#666b78", fontSize: 12 },
  stopButton: { marginTop: 6, borderRadius: 18, backgroundColor: "#c62828", minHeight: 72, alignItems: "center", justifyContent: "center" },
  stopText: { color: "white", fontSize: 25, fontWeight: "900" },
  stopHint: { color: "white", opacity: 0.82, fontSize: 12, marginTop: 1 },
  resultCard: { backgroundColor: "white", borderRadius: 20, padding: 20, marginTop: 6, alignItems: "center" },
  resultTitle: { fontSize: 20, fontWeight: "900" },
  resultScore: { fontSize: 42, fontWeight: "900", marginTop: 4, color: "#151f63" },
  resultSub: { color: "#666b78", fontWeight: "700" },
  primaryButton: { marginTop: 18, backgroundColor: "#151f63", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13 },
  primaryText: { color: "white", fontSize: 15, fontWeight: "800" },
  errorBox: { backgroundColor: "#fff0ef", borderRadius: 12, padding: 12, marginTop: 3, marginBottom: 10 },
  errorText: { color: "#b42318", fontSize: 13, textAlign: "center" },
});
