import { supabase } from "@/integrations/supabase/client";

export type Subject = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export type PracticeType = "none" | "questions" | "simulado";

export type StudySession = {
  id: string;
  subject_id: string;
  session_date: string;
  duration_minutes: number;
  study_method: string | null;
  study_method_other: string | null;
  made_summary: boolean;
  made_review: boolean;
  practice_type: PracticeType;
  questions_total: number | null;
  questions_correct: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const STUDY_METHODS = [
  { value: "leitura", label: "Leitura" },
  { value: "videoaula", label: "Videoaula" },
  { value: "exercicios", label: "Exercícios" },
  { value: "flashcards", label: "Flashcards" },
  { value: "aula_ao_vivo", label: "Aula ao vivo" },
  { value: "outro", label: "Outro" },
] as const;

export const PALETTE = [
  "#6366f1",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#22c55e",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#3b82f6",
  "#a3e635",
];

export function methodLabel(session: StudySession): string {
  if (!session.study_method) return "—";
  if (session.study_method === "outro") return session.study_method_other || "Outro";
  return STUDY_METHODS.find((m) => m.value === session.study_method)?.label ?? session.study_method;
}

export function practiceLabel(session: StudySession): string {
  if (session.practice_type === "none") return "—";
  if (session.practice_type === "simulado")
    return `Simulado: ${session.questions_correct}/${session.questions_total}`;
  return `${session.questions_correct}/${session.questions_total} questões`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

export function todayISO(): string {
  const now = new Date();
  const off = now.getTimezoneOffset();
  return new Date(now.getTime() - off * 60000).toISOString().slice(0, 10);
}

export async function fetchSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase.from("subjects").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Subject[];
}

export async function fetchSessions(): Promise<StudySession[]> {
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudySession[];
}

export async function createSubject(rawName: string, existingCount: number): Promise<Subject> {
  const name = rawName.trim();
  const { data: existing } = await supabase
    .from("subjects")
    .select("*")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return existing as Subject;

  const { data, error } = await supabase
    .from("subjects")
    .insert({ name, color: PALETTE[existingCount % PALETTE.length] })
    .select()
    .single();
  if (error) throw error;
  return data as Subject;
}

export type SessionPayload = {
  subject_id: string;
  session_date: string;
  duration_minutes: number;
  study_method: string | null;
  study_method_other: string | null;
  made_summary: boolean;
  made_review: boolean;
  practice_type: PracticeType;
  questions_total: number | null;
  questions_correct: number | null;
  notes: string | null;
};

export async function saveSession(payload: SessionPayload, id?: string) {
  if (id) {
    const { error } = await supabase.from("study_sessions").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("study_sessions").insert(payload);
    if (error) throw error;
  }
}

export async function deleteSession(id: string) {
  const { error } = await supabase.from("study_sessions").delete().eq("id", id);
  if (error) throw error;
}
