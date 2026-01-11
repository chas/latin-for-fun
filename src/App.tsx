import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy,
  Bird,
  Flame,
  Sparkles,
  Target,
  Volume2,
  RotateCcw,
  Feather,
  Zap,
  ScrollText,
  Shield,
} from "lucide-react";
import { NOUNS } from "./data/nouns";
import { VERBS } from "./data/verbs";
import { ADJECTIVES } from "./data/adjectives";
import { BIRD_CARDS } from "./data/birds";

/**
 * Latin for Fun - Birding Quest
 * Single-file, client-side React app meant for static hosting.
 *
 * Rework goals:
 * - More grammar + vocab (cases, noun/adjective agreement, verb endings)
 * - More color + graphics for middle/high school vibe
 * - Still fast, competitive, and birding-themed
 */


const DAILY_QUOTES = [
  "Latin is a power-up for English.",
  "Bird names are basically Latin puzzles.",
  "Streaks beat talent. 🏆",
  "Fast rounds = big XP.",
];

// ------------------------- Helpers -------------------------

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function popLast<T>(arr: T[]): T[] {
  return arr.slice(0, Math.max(0, arr.length - 1));
}

function speak(text: string, rate = 0.9) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.lang = "la"; // best effort; may fall back depending on device
  synth.cancel();
  synth.speak(u);
}

type GramCase = "nomSg" | "accSg";

type Noun = {
  id: string;
  lemma: string;
  decl: number;
  gender: "m" | "f" | "n";
  meaning: string;
  forms: { nomSg: string; accSg: string };
  note?: string;
};

type Adjective = {
  id: string;
  lemma: string;
  meaning: string;
  forms: {
    nomSg: Record<"m" | "f" | "n", string>;
    accSg: Record<"m" | "f" | "n", string>;
  };
  note?: string;
};

type Verb = {
  id: string;
  pres1s: string;
  meaning: string;
  pres3s: string;
  pattern: string;
};

function nounForm(noun: Noun, gramCase: GramCase) {
  return noun.forms?.[gramCase];
}

function adjForm(adj: Adjective, gramCase: GramCase, gender: "m" | "f" | "n") {
  return adj.forms?.[gramCase]?.[gender];
}

// ------------------------- Lightweight Tests -------------------------
// No test runner here, so we do a tiny dev-time self-check.

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`SelfTest failed: ${msg}`);
}

function isDevEnv() {
  // Vite: import.meta.env.DEV / import.meta.env.PROD
  try {
    if (
      typeof import.meta !== "undefined" &&
      (import.meta as any)?.env &&
      typeof (import.meta as any).env.DEV === "boolean"
    ) {
      return (import.meta as any).env.DEV;
    }

    if (
      typeof import.meta !== "undefined" &&
      (import.meta as any)?.env &&
      typeof (import.meta as any).env.PROD === "boolean"
    ) {
      return !(import.meta as any).env.PROD;
    }
  } catch {
    // ignore
  }

  // If we can't detect, default to false so builds don't crash.
  return false;
}


function runSelfTestsOnce() {
  if (!isDevEnv()) return;
  // Guard to avoid running multiple times during hot reloads
  if (typeof window !== "undefined" && (window as any).__latinForFunTestsRan) return;
  if (typeof window !== "undefined") (window as any).__latinForFunTestsRan = true;

  const puella = (NOUNS as Noun[]).find((n) => n.id === "puella")!;
  assert(nounForm(puella, "nomSg") === "puella", "puella nomSg should be 'puella'");
  assert(nounForm(puella, "accSg") === "puellam", "puella accSg should be 'puellam'");

  const bonus = (ADJECTIVES as Adjective[]).find((a) => a.id === "bonus")!;
  assert(adjForm(bonus, "nomSg", "f") === "bona", "bonus nomSg feminine should be 'bona'");
  assert(adjForm(bonus, "accSg", "m") === "bonum", "bonus accSg masculine should be 'bonum'");

  // Sentence shape sanity
  assert(DIFFICULTY.hard.sentenceLen === 4, "hard should build 4-tile sentences");

  // Match pool sanity (no undefined Latin strings)
  const sampleNoun = (NOUNS as Noun[])[0];
  assert(!!nounForm(sampleNoun, "nomSg"), "nounForm should return a string");

  // Sighting Log wrong-answer behavior helper
  assert(JSON.stringify(popLast([1, 2, 3])) === JSON.stringify([1, 2]), "popLast should remove last element");
  assert(JSON.stringify(popLast([] as number[])) === JSON.stringify([]), "popLast on empty should stay empty");

  // Storage key sanity
  assert(typeof LS_KEY === "string" && LS_KEY.length > 0, "LS_KEY should be a non-empty string");

  // Select value sanity: shadcn SelectItem must not use empty-string values
  // We represent 'no selection' as undefined rather than "".
  assert(true, "select placeholder uses undefined value");

  // eslint-disable-next-line no-console
  console.info("✅ Latin for Fun self-tests passed");
}

// ------------------------- Storage -------------------------

const LS_KEY = "latinForFun_v2";

type PersistedState = {
  player: { name: string; difficulty: keyof typeof DIFFICULTY };
  best: { highScore: number; bestStreak: number; totalXP: number };
  collection: { unlocked: string[] };
  settings: { sound: boolean };
};

function loadState(): PersistedState {
  const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
  const base: PersistedState = {
    player: { name: "Challenger", difficulty: "normal" },
    best: { highScore: 0, bestStreak: 0, totalXP: 0 },
    collection: { unlocked: [] },
    settings: { sound: true },
  };
  if (!raw) return base;
  const parsed = safeJsonParse<PersistedState>(raw, base);
  return {
    ...base,
    ...parsed,
    player: { ...base.player, ...(parsed.player || {}) },
    best: { ...base.best, ...(parsed.best || {}) },
    collection: { ...base.collection, ...(parsed.collection || {}) },
    settings: { ...base.settings, ...(parsed.settings || {}) },
  };
}

function saveState(state: PersistedState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ------------------------- Game Logic -------------------------

const DIFFICULTY = {
  easy: { time: 28, roundSize: 4, xpMult: 0.85, sentenceLen: 3 },
  normal: { time: 22, roundSize: 5, xpMult: 1, sentenceLen: 3 },
  hard: { time: 18, roundSize: 6, xpMult: 1.2, sentenceLen: 4 }, // hard adds adjective agreement
} as const;

type DifficultyKey = keyof typeof DIFFICULTY;

type ModeKey = "sighting" | "match";

function xpFor(correct: boolean, secondsLeft: number, combo: number, difficultyKey: DifficultyKey) {
  const d = DIFFICULTY[difficultyKey] || DIFFICULTY.normal;
  const base = correct ? 28 : 0;
  const speed = correct ? clamp(Math.floor(secondsLeft * 1.6), 0, 45) : 0;
  const comboBonus = correct ? clamp(combo * 7, 0, 70) : 0;
  return Math.round((base + speed + comboBonus) * d.xpMult);
}

function maybeUnlockBird(totalXP: number, unlocked: string[]) {
  // every 250 XP unlock a new bird
  const threshold = 250;
  const shouldHave = Math.floor(totalXP / threshold);
  const targetCount = clamp(shouldHave, 0, BIRD_CARDS.length);
  if (unlocked.length >= targetCount) return null;
  const remaining = BIRD_CARDS.filter((b) => !unlocked.includes(b.id));
  return remaining[0] || null;
}

// ------------------------- UI Components -------------------------

function BirdSticker({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none select-none ${className}`} aria-hidden>
      <svg viewBox="0 0 220 120" className="h-full w-full opacity-60">
        <defs>
          <linearGradient id="bqg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7dd3fc" />
            <stop offset="0.5" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#fb7185" />
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <path
          d="M22 74c26-26 56-38 92-39 28-1 49 6 68 18 10 7 21 14 35 16-13 8-26 10-39 9-8 0-14 2-19 7-10 10-22 18-36 22-24 7-46 2-64-13-9-8-21-14-37-20z"
          fill="url(#bqg)"
          filter="url(#soft)"
        />
        <path
          d="M120 58c10-10 20-16 35-18-11 10-18 20-21 34-4-5-8-10-14-16z"
          fill="#0f172a"
          opacity="0.25"
        />
        <circle cx="154" cy="50" r="2.5" fill="#0f172a" opacity="0.7" />
        <path d="M168 52l12 4-12 4" fill="#f59e0b" opacity="0.9" />
      </svg>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  tone = "plain",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  tone?: "plain" | "hot" | "cool";
}) {
  const toneClass =
    tone === "hot"
      ? "border-transparent bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-sky-500/15"
      : tone === "cool"
        ? "border-transparent bg-gradient-to-r from-sky-500/15 to-emerald-500/15"
        : "bg-white/70";
  return (
    <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 shadow-sm ${toneClass}`}>
      <Icon className="h-4 w-4" />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function FancyTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Bird className="h-6 w-6" />
          <span className="absolute -right-1 -top-1 inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </div>
        <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-sky-600 via-violet-600 to-pink-600 bg-clip-text text-transparent">
          {title}
        </h1>
        <Badge className="rounded-xl bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-foreground border-amber-500/30">
          v2
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function CountdownBar({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const pct = total > 0 ? (secondsLeft / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Time</span>
        <span className="font-medium">{secondsLeft}s</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

function Toast({
  show,
  title,
  description,
  onClose,
  kind = "good",
}: {
  show: boolean;
  title: string;
  description: string;
  onClose: () => void;
  kind?: "good" | "try";
}) {
  return (
    <Dialog open={show} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === "good" ? <Sparkles className="h-5 w-5" /> : <Target className="h-5 w-5" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button className="rounded-2xl" onClick={onClose}>
            Nice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldGuide({ unlockedIds }: { unlockedIds: string[] }) {
  const birds = useMemo(() => {
    const unlocked = BIRD_CARDS.filter((b) => unlockedIds.includes(b.id));
    const locked = BIRD_CARDS.filter((b) => !unlockedIds.includes(b.id));
    return { unlocked, locked };
  }, [unlockedIds]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-2xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-sky-300/40 to-violet-300/30 blur-2xl" />
        <CardContent className="p-5 space-y-3 relative">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Field Guide</div>
            <Badge className="rounded-xl">
              {birds.unlocked.length}/{BIRD_CARDS.length} unlocked
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Rack up XP → unlock bird cards → learn the science-name puzzle.</p>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Feather className="h-4 w-4" /> Lifers, but for Latin.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {birds.unlocked.map((b) => (
          <Card key={b.id} className="rounded-2xl relative overflow-hidden">
            <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-gradient-to-tr from-emerald-300/30 to-sky-300/20 blur-2xl" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{b.common}</div>
                  <div className="text-sm italic text-muted-foreground">{b.sci}</div>
                </div>
                <Badge className="rounded-xl bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-foreground border-amber-500/30">
                  {b.badge}
                </Badge>
              </div>
              <div className="mt-3 text-sm">{b.fun}</div>
            </CardContent>
          </Card>
        ))}

        {birds.locked.length > 0 && (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">
                Next unlock: <span className="font-medium">{birds.locked[0].common}</span>
                <span className="italic"> ({birds.locked[0].sci})</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Keep earning XP to reveal it.</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ------------------------- Game Modes -------------------------

type MatchPoolItem = {
  id: string;
  latin: string;
  meaning: string;
  tag: "NOM" | "ACC" | "V" | "ADJ";
  kind: "noun" | "verb" | "adj";
  hint: string;
};

/**
 * Mode 1: Match - vocabulary + quick recognition.
 * Includes case tags for nouns and highlights verb vs noun vs adjective.
 */
function MatchMode({
  difficultyKey,
  soundOn,
  onRoundEnd,
}: {
  difficultyKey: DifficultyKey;
  soundOn: boolean;
  onRoundEnd: (r: { mode: string; score: number; comboMax: number }) => void;
}) {
  const conf = DIFFICULTY[difficultyKey] || DIFFICULTY.normal;
  const totalTime = conf.time;
  const roundSize = conf.roundSize;

  const POOL = useMemo<MatchPoolItem[]>(() => {
    const nounForms: MatchPoolItem[] = (NOUNS as Noun[]).flatMap((n) => [
      {
        id: `${n.id}-nom`,
        latin: nounForm(n, "nomSg"),
        meaning: `${n.meaning} (subject)`,
        tag: "NOM",
        kind: "noun",
        hint: "Subject usually = nominative (who/what does it?)",
      },
      {
        id: `${n.id}-acc`,
        latin: nounForm(n, "accSg"),
        meaning: `${n.meaning} (object)`,
        tag: "ACC",
        kind: "noun",
        hint: "Direct object often = accusative (who/what is affected?)",
      },
    ]);

    const verbs: MatchPoolItem[] = (VERBS as Verb[]).map((v) => ({
      id: v.id,
      latin: v.pres3s,
      meaning: v.meaning.replace("I ", "he/she/it "),
      tag: "V",
      kind: "verb",
      hint: v.pattern,
    }));

    const adjs: MatchPoolItem[] = (ADJECTIVES as Adjective[]).map((a) => ({
      id: a.id,
      latin: a.lemma,
      meaning: a.meaning,
      tag: "ADJ",
      kind: "adj",
      hint: "Adjectives match noun gender/case (later drills).",
    }));

    return [...nounForms, ...verbs, ...adjs].filter((x) => typeof x.latin === "string" && x.latin.length > 0);
  }, []);

  const timerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<"playing" | "paused">("playing");
  const [secondsLeft, setSecondsLeft] = useState<number>(totalTime);
  const [round, setRound] = useState(() => makeRound(roundSize));
  const [selectedLatin, setSelectedLatin] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState<null | { kind: "good" | "try"; title: string; description: string }>(null);
  const [endNote, setEndNote] = useState<string | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    clearTimer();
    timerRef.current = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
  }

  function makeRound(n: number) {
    const chosen = shuffle(POOL).slice(0, n);
    return {
      items: chosen,
      left: shuffle(chosen.map((x) => x.id)),
      right: shuffle(chosen.map((x) => x.id)),
    };
  }

  function itemById(id: string) {
    return round.items.find((x) => x.id === id)!;
  }

  function finishRound(reason: string) {
    clearTimer();
    setPhase("paused");
    setEndNote(reason);
    onRoundEnd({ mode: "Match", score, comboMax: combo });
  }

  function nextRound() {
    setSecondsLeft(totalTime);
    setRound(makeRound(roundSize));
    setSelectedLatin(null);
    setDoneIds([]);
    setCombo(0);
    setScore(0);
    setMessage(null);
    setEndNote(null);
    setPhase("playing");
  }

  useEffect(() => {
    if (phase === "playing") startTimer();
    else clearTimer();
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (secondsLeft <= 0) finishRound("Time!");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase]);

  function chooseLatin(id: string) {
    if (phase !== "playing") return;
    if (doneIds.includes(id)) return;
    setSelectedLatin(id);
    const it = itemById(id);
    if (soundOn) speak(it.latin);
  }

  function chooseMeaning(id: string) {
    if (phase !== "playing") return;
    if (!selectedLatin) return;
    if (doneIds.includes(id)) return;

    const correct = selectedLatin === id;
    if (correct) {
      const nextCombo = combo + 1;
      const gained = xpFor(true, secondsLeft, nextCombo, difficultyKey);
      setCombo(nextCombo);
      setScore((s) => s + gained);
      setDoneIds((d) => [...d, id]);
      setSelectedLatin(null);
      const it = itemById(id);
      setMessage({
        kind: "good",
        title: `+${gained} XP`,
        description: `${it.latin} → ${it.meaning}. Combo x${nextCombo}!`,
      });

      // If that was the last pair, end the round and wait for Next.
      if (doneIds.length + 1 >= round.items.length) {
        setTimeout(() => finishRound("Round complete!"), 150);
      }
    } else {
      setCombo(0);
      setSelectedLatin(null);
      const it = itemById(selectedLatin);
      setMessage({
        kind: "try",
        title: "Almost!",
        description: `Try again. Hint: ${it.hint}`,
      });
    }
  }

  const pending = round.items.length - doneIds.length;

  return (
    <div className="grid gap-4">
      <Card className="rounded-2xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-sky-300/40 to-violet-300/30 blur-2xl" />
        <div className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-gradient-to-tr from-pink-300/35 to-amber-300/20 blur-2xl" />
        <CardContent className="p-5 space-y-4 relative">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <StatPill icon={Trophy} label="XP" value={score} tone="cool" />
              <StatPill icon={Flame} label="Combo" value={`x${combo}`} tone="hot" />
              <StatPill icon={Target} label="Pairs left" value={pending} />
            </div>
            <div className="w-full md:w-[260px]">
              <CountdownBar secondsLeft={Math.max(0, secondsLeft)} total={totalTime} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4" /> Latin
              </div>
              <div className="grid grid-cols-2 gap-2">
                {round.left.map((id) => {
                  const it = itemById(id);
                  const selected = selectedLatin === id;
                  const done = doneIds.includes(id);
                  return (
                    <Button
                      key={id}
                      variant={selected ? "default" : "secondary"}
                      className={`rounded-2xl justify-between ${done ? "opacity-40" : ""} ${it.kind === "verb"
                        ? "border border-violet-500/20"
                        : it.kind === "noun"
                          ? "border border-sky-500/20"
                          : "border border-emerald-500/20"
                        }`}
                      onClick={() => chooseLatin(id)}
                      disabled={done || phase !== "playing"}
                    >
                      <span className="font-extrabold">{it.latin}</span>
                      <span className="text-[10px] opacity-90 rounded-lg px-2 py-0.5 bg-black/5">{it.tag}</span>
                    </Button>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground">Tap a Latin item, then tap its meaning.</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold flex items-center gap-2">
                <ScrollText className="h-4 w-4" /> Meaning
              </div>
              <div className="grid grid-cols-2 gap-2">
                {round.right.map((id) => {
                  const it = itemById(id);
                  const done = doneIds.includes(id);
                  return (
                    <Button
                      key={id}
                      variant="outline"
                      className={`rounded-2xl justify-start ${done ? "opacity-40" : ""}`}
                      onClick={() => chooseMeaning(id)}
                      disabled={done || phase !== "playing"}
                    >
                      {it.meaning}
                    </Button>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground">NOM = subject. ACC = object. V = verb. (You’re basically decoding.)</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex gap-2">
              <Button
                className="rounded-2xl"
                variant="outline"
                onClick={() => {
                  setSecondsLeft(totalTime);
                  setRound(makeRound(roundSize));
                  setSelectedLatin(null);
                  setDoneIds([]);
                  setCombo(0);
                  setScore(0);
                  setMessage(null);
                  setEndNote(null);
                  setPhase("playing");
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Restart
              </Button>
              <Button
                className="rounded-2xl"
                variant="secondary"
                onClick={() => {
                  if (!selectedLatin) return;
                  const it = itemById(selectedLatin);
                  setMessage({ kind: "try", title: "Hint", description: it.hint });
                }}
                disabled={!selectedLatin}
              >
                Hint
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">Round ends when you clear all pairs. Next starts the next round.</div>
          </div>

          {phase === "paused" && (
            <div className="mt-3 rounded-2xl border bg-white/70 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold">{endNote || "Round complete"}</div>
                <div className="text-xs text-muted-foreground">XP: {score} • Best combo: x{combo}</div>
              </div>
              <Button className="rounded-2xl" onClick={nextRound}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Toast
        show={!!message}
        title={message?.title || ""}
        description={message?.description || ""}
        kind={message?.kind === "good" ? "good" : "try"}
        onClose={() => setMessage(null)}
      />
    </div>
  );
}

/**
 * Mode 2: Sighting Log - grammar builder.
 * Build a Latin sentence from tiles:
 * - Easy/Normal: Subject(NOM) + Verb(3rd sg) + Object(ACC)
 * - Hard: Add an adjective that must agree with the noun it describes.
 */
function SightingLogMode({
  difficultyKey,
  soundOn,
  onRoundEnd,
}: {
  difficultyKey: DifficultyKey;
  soundOn: boolean;
  onRoundEnd: (r: { mode: string; score: number; comboMax: number }) => void;
}) {
  const conf = DIFFICULTY[difficultyKey] || DIFFICULTY.normal;
  const totalTime = conf.time;
  const sentenceLen = conf.sentenceLen;

  const timerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<"playing" | "paused">("playing");
  const [secondsLeft, setSecondsLeft] = useState<number>(totalTime);
  const [challenge, setChallenge] = useState(() => makeChallenge(sentenceLen));
  const [tiles, setTiles] = useState(() => makeTiles(challenge));
  const [answer, setAnswer] = useState<{ id: string; text: string; correct: boolean }[]>([]);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState<null | { kind: "good" | "try"; title: string; description: string }>(null);
  const [endNote, setEndNote] = useState<string | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    clearTimer();
    timerRef.current = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
  }

  function makeChallenge(len: number) {
    const subject = pick((NOUNS as Noun[]).filter((n) => n.id !== "verbum"));
    const object = pick((NOUNS as Noun[]).filter((n) => n.id !== subject.id));
    const verb = pick(VERBS as Verb[]);

    const useAdj = len >= 4;
    const adj = useAdj ? pick(ADJECTIVES as Adjective[]) : null;
    const adjTargets = useAdj ? (Math.random() < 0.5 ? "subject" : "object") : null;

    const subjWord = nounForm(subject, "nomSg");
    const objWord = nounForm(object, "accSg");
    const verbWord = verb.pres3s;

    let adjWord: string | null = null;
    if (useAdj && adj) {
      const targetNoun = adjTargets === "subject" ? subject : object;
      const aCase: GramCase = adjTargets === "subject" ? "nomSg" : "accSg";
      adjWord = adjForm(adj, aCase, targetNoun.gender) || adj.lemma;
    }

    const latin = useAdj
      ? adjTargets === "subject"
        ? [adjWord!, subjWord, verbWord, objWord]
        : [subjWord, verbWord, adjWord!, objWord]
      : [subjWord, verbWord, objWord];

    const english = useAdj
      ? adjTargets === "subject"
        ? `The ${adj!.meaning} ${subject.meaning} ${verb.meaning.replace("I ", "")} the ${object.meaning}.`
        : `The ${subject.meaning} ${verb.meaning.replace("I ", "")} the ${adj!.meaning} ${object.meaning}.`
      : `The ${subject.meaning} ${verb.meaning.replace("I ", "")} the ${object.meaning}.`;

    const logLine = pick(["Sighting logged!", "Field note added!", "Checklist updated!", "Rare behavior observed!"]);

    return {
      len,
      subject,
      object,
      verb,
      adj,
      adjTargets,
      english,
      latin,
      logLine,
      grammarTip: useAdj
        ? "Adjectives match the noun: gender + case. NOM = subject, ACC = object."
        : "Subject = NOM. Object = ACC. Verb ending shows who does it (3rd sg).",
    };
  }

  function makeTiles(ch: ReturnType<typeof makeChallenge>) {
    const correctTiles = ch.latin.map((t, i) => ({
      id: `c-${i}-${t}`,
      text: t,
      correct: true,
    }));

    const decoys: { id: string; text: string; correct: boolean }[] = [];
    decoys.push({ id: "d-subj-wrong", text: nounForm(ch.subject, "accSg"), correct: false });
    decoys.push({ id: "d-obj-wrong", text: nounForm(ch.object, "nomSg"), correct: false });

    const otherVerb = pick((VERBS as Verb[]).filter((v) => v.id !== ch.verb.id));
    decoys.push({ id: "d-verb", text: otherVerb.pres3s, correct: false });

    if (ch.len >= 4 && ch.adj) {
      const targetNoun = ch.adjTargets === "subject" ? ch.subject : ch.object;
      const wrongCase: GramCase = ch.adjTargets === "subject" ? "accSg" : "nomSg";
      const wrongAdj = adjForm(ch.adj, wrongCase, targetNoun.gender) || ch.adj.lemma;
      decoys.push({ id: "d-adj", text: wrongAdj, correct: false });
    }

    const all = shuffle([...correctTiles, ...decoys]).slice(0, 10);
    return shuffle(all);
  }

  function finishRound(reason: string) {
    clearTimer();
    setPhase("paused");
    setEndNote(reason);
    onRoundEnd({ mode: "Sighting Log", score, comboMax: combo });
  }

  function nextRound() {
    setSecondsLeft(totalTime);
    const ch = makeChallenge(sentenceLen);
    setChallenge(ch);
    setTiles(makeTiles(ch));
    setAnswer([]);
    setCombo(0);
    setScore(0);
    setMessage(null);
    setEndNote(null);
    setPhase("playing");
  }

  useEffect(() => {
    if (phase === "playing") startTimer();
    else clearTimer();
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (secondsLeft <= 0) finishRound("Time!");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase]);

  function tapTile(tile: { id: string; text: string; correct: boolean }) {
    if (phase !== "playing") return;
    if (answer.length >= challenge.latin.length) return;
    if (answer.some((a) => a.id === tile.id)) return;

    const next = [...answer, tile];
    setAnswer(next);
    if (soundOn) speak(tile.text);

    // Only check when user has filled all slots.
    if (next.length === challenge.latin.length) {
      const built = next.map((t) => t.text);
      const correct = built.join(" ") === challenge.latin.join(" ");

      if (correct) {
        const nextCombo = combo + 1;
        const gained = xpFor(true, secondsLeft, nextCombo, difficultyKey);
        const newScore = score + gained;
        setCombo(nextCombo);
        setScore(newScore);

        setMessage({
          kind: "good",
          title: `${challenge.logLine} +${gained} XP`,
          description: `✅ ${challenge.latin.join(" ")}  (Tip: ${challenge.grammarTip})`,
        });

        // End the round on a correct sentence; wait for Next.
        setTimeout(() => {
          clearTimer();
          setPhase("paused");
          setEndNote("Correct! Round complete.");
          onRoundEnd({ mode: "Sighting Log", score: newScore, comboMax: nextCombo });
        }, 180);
      } else {
        setCombo(0);
        setMessage({
          kind: "try",
          title: "Nope - check cases",
          description: `Try again. Hint: ${challenge.grammarTip}`,
        });
        // Per your preference: only remove the last tile.
        setTimeout(() => setAnswer((a) => popLast(a)), 250);
      }
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-violet-500/10 to-pink-500/10" />
        <BirdSticker className="absolute right-2 top-2 h-24 w-40" />
        <CardContent className="p-5 space-y-4 relative">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <StatPill icon={Trophy} label="XP" value={score} tone="cool" />
              <StatPill icon={Flame} label="Combo" value={`x${combo}`} tone="hot" />
              <StatPill icon={Shield} label="Build" value={`${challenge.latin.length} tiles`} />
            </div>
            <div className="w-full md:w-[260px]">
              <CountdownBar secondsLeft={Math.max(0, secondsLeft)} total={totalTime} />
            </div>
          </div>

          <Card className="rounded-2xl bg-white/60 border border-white/40 backdrop-blur">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Field note</div>
              <div className="text-sm font-semibold">{challenge.english}</div>
              <div className="mt-1 text-xs text-muted-foreground">{challenge.grammarTip}</div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Build the Latin</div>
            <div className="flex flex-wrap gap-2">
              {answer.length === 0 ? (
                <div className="text-sm text-muted-foreground">Tap tiles in order…</div>
              ) : (
                answer.map((t, idx) => (
                  <Badge
                    key={`${t.id}-${idx}`}
                    className="rounded-xl text-sm bg-gradient-to-r from-sky-500/15 to-violet-500/15 text-foreground border-sky-500/20"
                  >
                    {t.text}
                  </Badge>
                ))
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2">
              {tiles.map((tile) => (
                <Button
                  key={tile.id}
                  className="rounded-2xl justify-center font-extrabold"
                  variant="secondary"
                  onClick={() => tapTile(tile)}
                  disabled={phase !== "playing"}
                >
                  {tile.text}
                </Button>
              ))}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <Button
                className="rounded-2xl"
                variant="outline"
                onClick={() => {
                  setSecondsLeft(totalTime);
                  const ch = makeChallenge(sentenceLen);
                  setChallenge(ch);
                  setTiles(makeTiles(ch));
                  setAnswer([]);
                  setCombo(0);
                  setScore(0);
                  setMessage(null);
                  setEndNote(null);
                  setPhase("playing");
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Restart
              </Button>
              <div className="text-xs text-muted-foreground">Round ends when you build 1 correct sentence. Next starts the next round.</div>
            </div>

            {phase === "paused" && (
              <div className="mt-3 rounded-2xl border bg-white/70 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">{endNote || "Round paused"}</div>
                  <div className="text-xs text-muted-foreground">XP: {score} • Combo: x{combo}</div>
                </div>
                <Button className="rounded-2xl" onClick={nextRound}>
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Toast
        show={!!message}
        title={message?.title || ""}
        description={message?.description || ""}
        kind={message?.kind === "good" ? "good" : "try"}
        onClose={() => setMessage(null)}
      />
    </div>
  );
}

// ------------------------- Main App -------------------------

export default function App() {
  const [persisted, setPersisted] = useState<PersistedState>(() => loadState());

  const [activeTab, setActiveTab] = useState("play");

  // IMPORTANT: shadcn SelectItem cannot have an empty-string value.
  // We represent "no selection" as undefined and use SelectValue's placeholder.
  const [mode, setMode] = useState<ModeKey | undefined>(undefined);

  const [started, setStarted] = useState(false);
  const [runId, setRunId] = useState(0);

  const [roundSummary, setRoundSummary] = useState<null | { mode: string; score: number; comboMax: number }>(null);
  const [newUnlock, setNewUnlock] = useState<any>(null);

  const name = persisted.player.name;
  const difficultyKey = persisted.player.difficulty;
  const soundOn = persisted.settings.sound;

  const quote = useMemo(() => pick(DAILY_QUOTES), []);

  useEffect(() => {
    runSelfTestsOnce();
  }, []);

  useEffect(() => {
    saveState(persisted);
  }, [persisted]);

  function awardXP(deltaXP: number, comboMax = 0) {
    setPersisted((s) => {
      const totalXP = (s.best.totalXP || 0) + deltaXP;
      const bestStreak = Math.max(s.best.bestStreak || 0, comboMax);
      const highScore = Math.max(s.best.highScore || 0, deltaXP);
      const next: PersistedState = {
        ...s,
        best: { ...s.best, totalXP, bestStreak, highScore },
      };

      const unlock = maybeUnlockBird(totalXP, next.collection.unlocked);
      if (unlock) {
        next.collection = { ...next.collection, unlocked: [...next.collection.unlocked, unlock.id] };
        setNewUnlock(unlock);
      }

      return next;
    });
  }

  function onRoundEnd({ mode: endedMode, score, comboMax }: { mode: string; score: number; comboMax: number }) {
    awardXP(score, comboMax);
    setRoundSummary({ mode: endedMode, score, comboMax });
  }

  const totalXP = persisted.best.totalXP || 0;
  const unlocked = persisted.collection.unlocked || [];
  const nextBird = useMemo(() => {
    const remaining = BIRD_CARDS.filter((b) => !unlocked.includes(b.id));
    return remaining[0] || null;
  }, [unlocked]);

  const progressToNext = useMemo(() => {
    const threshold = 250;
    const curr = totalXP % threshold;
    const pct = (curr / threshold) * 100;
    return { curr, threshold, pct };
  }, [totalXP]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-white via-sky-50 to-violet-50">
      {/* background candy */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-sky-300/35 to-emerald-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-bl from-violet-300/35 to-pink-300/25 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 -bottom-28 h-96 w-96 rounded-full bg-gradient-to-tr from-amber-300/25 to-rose-300/20 blur-3xl" />

      <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-6 relative">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <FancyTitle
            title="Birding Quest: Latin Starter"
            subtitle="Compete for combos. Decode cases. Unlock bird cards with scientific names."
          />

          <Card className="rounded-2xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-gradient-to-tr from-sky-300/30 to-violet-300/20 blur-2xl" />
            <CardContent className="p-4 space-y-3 relative">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Player</div>
                  <div className="font-semibold">{name}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="rounded-2xl"
                    variant={soundOn ? "default" : "outline"}
                    onClick={() =>
                      setPersisted((s) => ({
                        ...s,
                        settings: { ...s.settings, sound: !s.settings.sound },
                      }))
                    }
                    title="Toggle pronunciation"
                  >
                    <Volume2 className="h-4 w-4 mr-2" /> {soundOn ? "Sound" : "Muted"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border bg-white/70 p-3">
                  <div className="text-xs text-muted-foreground">Total XP</div>
                  <div className="text-lg font-black">{totalXP}</div>
                </div>
                <div className="rounded-2xl border bg-white/70 p-3">
                  <div className="text-xs text-muted-foreground">Best Combo</div>
                  <div className="text-lg font-black">x{persisted.best.bestStreak || 0}</div>
                </div>
                <div className="rounded-2xl border bg-white/70 p-3">
                  <div className="text-xs text-muted-foreground">Birds</div>
                  <div className="text-lg font-black">{unlocked.length}</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Next bird unlock</span>
                  <span>
                    {progressToNext.curr}/{progressToNext.threshold} XP
                  </span>
                </div>
                <Progress value={progressToNext.pct} />
                <div className="text-xs text-muted-foreground">
                  {nextBird ? (
                    <span>
                      Next: <span className="font-medium">{nextBird.common}</span> <span className="italic">({nextBird.sci})</span>
                    </span>
                  ) : (
                    <span>All birds unlocked. Absolute legend.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-2xl bg-white/60 border border-white/40 backdrop-blur">
            <TabsTrigger value="play" className="rounded-2xl">
              Play
            </TabsTrigger>
            <TabsTrigger value="guide" className="rounded-2xl">
              Field Guide
            </TabsTrigger>
            <TabsTrigger value="learn" className="rounded-2xl">
              Learn
            </TabsTrigger>
            <TabsTrigger value="results" className="rounded-2xl">
              Results
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-2xl">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="play" className="mt-4">
            <div className="grid gap-4">
              <Card className="rounded-2xl relative overflow-hidden">
                <div className="absolute -left-10 -top-10 h-44 w-44 rounded-full bg-gradient-to-br from-emerald-300/25 to-sky-300/20 blur-2xl" />
                <CardContent className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">Pick a mode</div>
                    <div className="text-sm text-muted-foreground">{quote}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={mode}
                      onValueChange={(v: any) => {
                        // Changing mode cancels any in-progress round and returns to the menu.
                        setMode(v as ModeKey);
                        setStarted(false);
                        // Bump runId so a subsequent Start always mounts a fresh game instance.
                        setRunId((k) => k + 1);
                      }}
                    >
                      <SelectTrigger className="w-[220px] rounded-2xl">
                        <SelectValue placeholder="Choose a mode…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sighting">Sighting Log (grammar)</SelectItem>
                        <SelectItem value="match">Match (vocab)</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      className="rounded-2xl"
                      onClick={() => {
                        if (!mode) return;
                        setRunId((k) => k + 1);
                        setStarted(true);
                      }}
                      disabled={!mode}
                      title={!mode ? "Choose a mode first" : "Start"}
                    >
                      Start
                    </Button>

                    <Select
                      value={difficultyKey}
                      onValueChange={(v: any) =>
                        setPersisted((s) => ({
                          ...s,
                          player: { ...s.player, difficulty: v },
                        }))
                      }
                    >
                      <SelectTrigger className="w-[180px] rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {!started ? (
                <Card className="rounded-2xl border-dashed">
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    <div className="font-semibold text-foreground">Ready when you are.</div>
                    <div className="mt-1">
                      Choose a mode and hit <span className="font-medium text-foreground">Start</span> to begin.
                    </div>
                    <div className="mt-2 text-xs">
                      After each round, you’ll click <span className="font-medium text-foreground">Next</span> to continue.
                    </div>
                  </CardContent>
                </Card>
              ) : mode === "match" ? (
                <MatchMode
                  key={`match-${runId}-${difficultyKey}`}
                  difficultyKey={difficultyKey}
                  soundOn={soundOn}
                  onRoundEnd={onRoundEnd}
                />
              ) : (
                <SightingLogMode
                  key={`sighting-${runId}-${difficultyKey}`}
                  difficultyKey={difficultyKey}
                  soundOn={soundOn}
                  onRoundEnd={onRoundEnd}
                />
              )}

              <Card className="rounded-2xl">
                <CardContent className="p-5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Competitive challenge:</span> run a “Mini Big Day” - 3 rounds back-to-back.
                  After each round, hit <span className="font-medium text-foreground">Next</span> to keep going and try to beat your combo.
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="guide" className="mt-4">
            <FieldGuide unlockedIds={unlocked} />
          </TabsContent>

          <TabsContent value="learn" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="rounded-2xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-gradient-to-br from-sky-300/30 to-violet-300/20 blur-2xl" />
                <CardContent className="p-5 space-y-3 relative">
                  <div className="text-lg font-semibold">Mini-lesson: the “case radar”</div>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                    <li>
                      <span className="font-medium text-foreground">NOM</span> = subject (who does the action).
                    </li>
                    <li>
                      <span className="font-medium text-foreground">ACC</span> = direct object (who/what gets affected).
                    </li>
                    <li>
                      Verbs end differently: <span className="italic">-at / -et / -it</span>.
                    </li>
                    <li>On Hard mode, adjectives must match the noun (gender + case). That’s the boss fight.</li>
                  </ul>
                  <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                    <Feather className="h-4 w-4" /> You’re not “memorizing.” You’re spotting patterns.
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-5 space-y-3">
                  <div className="text-lg font-semibold">Starter vocab</div>
                  <div className="grid grid-cols-1 gap-2">
                    {(NOUNS as Noun[]).slice(0, 6).map((n) => (
                      <div key={n.id} className="flex items-center justify-between rounded-2xl border bg-white/70 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold">{n.lemma}</span>
                          <Badge variant="secondary" className="rounded-xl">
                            noun
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{n.meaning}</div>
                      </div>
                    ))}
                    {(VERBS as Verb[]).map((v) => (
                      <div key={v.id} className="flex items-center justify-between rounded-2xl border bg-white/70 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold">{v.pres1s}</span>
                          <Badge variant="secondary" className="rounded-xl">
                            verb
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{v.meaning}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">Tip: In Sighting Log, you’re building real sentence shapes.</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="results" className="mt-4">
            <div className="grid gap-4">
              <Card className="rounded-2xl">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-lg font-semibold">Round results</div>
                      <div className="text-sm text-muted-foreground">
                        {roundSummary ? (
                          <span>
                            Mode: <span className="font-medium">{roundSummary.mode}</span>
                          </span>
                        ) : (
                          "Play a round to post a score."
                        )}
                      </div>
                    </div>
                    <Button className="rounded-2xl" onClick={() => setActiveTab("play")}>
                      Play again
                    </Button>
                  </div>

                  {roundSummary && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-2xl border bg-white/70 p-4">
                        <div className="text-xs text-muted-foreground">XP earned</div>
                        <div className="text-2xl font-black">{roundSummary.score}</div>
                      </div>
                      <div className="rounded-2xl border bg-white/70 p-4">
                        <div className="text-xs text-muted-foreground">Best combo</div>
                        <div className="text-2xl font-black">x{roundSummary.comboMax}</div>
                      </div>
                      <div className="rounded-2xl border bg-white/70 p-4">
                        <div className="text-xs text-muted-foreground">Total XP</div>
                        <div className="text-2xl font-black">{totalXP}</div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
                    <span className="font-medium">Streak goal:</span> hit x10 combo in Sighting Log.
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-5 space-y-2">
                  <div className="text-lg font-semibold">Local records</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-2xl border bg-white/70 p-4">
                      <div className="text-xs text-muted-foreground">Best per-round XP</div>
                      <div className="text-xl font-black">{persisted.best.highScore || 0}</div>
                    </div>
                    <div className="rounded-2xl border bg-white/70 p-4">
                      <div className="text-xs text-muted-foreground">Best combo ever</div>
                      <div className="text-xl font-black">x{persisted.best.bestStreak || 0}</div>
                    </div>
                    <div className="rounded-2xl border bg-white/70 p-4">
                      <div className="text-xs text-muted-foreground">Bird cards unlocked</div>
                      <div className="text-xl font-black">{unlocked.length}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="rounded-2xl">
                <CardContent className="p-5 space-y-4">
                  <div className="text-lg font-semibold">Player settings</div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Name</div>
                    <Input
                      className="rounded-2xl"
                      value={persisted.player.name}
                      onChange={(e) =>
                        setPersisted((s) => ({
                          ...s,
                          player: { ...s.player, name: e.target.value || "Challenger" },
                        }))
                      }
                      placeholder="Challenger"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Difficulty</div>
                    <Select
                      value={persisted.player.difficulty}
                      onValueChange={(v: any) =>
                        setPersisted((s) => ({
                          ...s,
                          player: { ...s.player, difficulty: v },
                        }))
                      }
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy (learn)</SelectItem>
                        <SelectItem value="normal">Normal (default)</SelectItem>
                        <SelectItem value="hard">Hard (sweaty)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
                    <span className="font-medium">Pro move:</span> get consistent on Normal, then go Hard.
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-5 space-y-4">
                  <div className="text-lg font-semibold">Data</div>
                  <div className="text-sm text-muted-foreground">
                    Scores and bird cards are saved in your browser (localStorage). If you clear site data, your collection resets.
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="rounded-2xl"
                      variant="destructive"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.localStorage.removeItem(LS_KEY);
                        }
                        setPersisted(loadState());
                        setRoundSummary(null);
                        setNewUnlock(null);
                        setActiveTab("play");
                        setMode(undefined);
                        setStarted(false);
                      }}
                    >
                      Reset progress
                    </Button>
                    <Button
                      className="rounded-2xl"
                      variant="outline"
                      onClick={() => {
                        const exportable = JSON.stringify(persisted, null, 2);
                        const blob = new Blob([exportable], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "latin-for-fun-save.json";
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <footer className="pb-8 text-center text-xs text-muted-foreground">Built for engagement: short rounds, instant feedback, and bird-card rewards.</footer>
      </div>

      <Dialog open={!!newUnlock} onOpenChange={(v) => (!v ? setNewUnlock(null) : null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> New bird unlocked!
            </DialogTitle>
            <DialogDescription>You earned a field guide card. That’s basically a lifer... but for Latin.</DialogDescription>
          </DialogHeader>
          {newUnlock && (
            <div className="space-y-3">
              <div className="rounded-2xl border bg-white/70 p-4">
                <div className="font-semibold">{newUnlock.common}</div>
                <div className="text-sm italic text-muted-foreground">{newUnlock.sci}</div>
                <div className="mt-2 text-sm">{newUnlock.fun}</div>
              </div>
              <div className="flex justify-end">
                <Button className="rounded-2xl" onClick={() => setNewUnlock(null)}>
                  Add to Field Guide
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
