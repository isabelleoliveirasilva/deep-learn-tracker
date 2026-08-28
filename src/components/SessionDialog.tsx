import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  STUDY_METHODS,
  createSubject,
  saveSession,
  todayISO,
  type PracticeType,
  type SessionPayload,
  type StudySession,
  type Subject,
} from "@/lib/study";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  session?: StudySession | null;
  defaultSubjectId?: string | null;
};

type Errors = Record<string, string>;

export function SessionDialog({ open, onOpenChange, subjects, session, defaultSubjectId }: Props) {
  const queryClient = useQueryClient();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("30");
  const [method, setMethod] = useState<string>("");
  const [methodOther, setMethodOther] = useState("");
  const [madeSummary, setMadeSummary] = useState(false);
  const [madeReview, setMadeReview] = useState(false);
  const [practice, setPractice] = useState<PracticeType>("none");
  const [total, setTotal] = useState("");
  const [correct, setCorrect] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSubjectSearch("");
    if (session) {
      setSubjectId(session.subject_id);
      setDate(session.session_date);
      setHours(String(Math.floor(session.duration_minutes / 60)));
      setMinutes(String(session.duration_minutes % 60));
      setMethod(session.study_method ?? "");
      setMethodOther(session.study_method_other ?? "");
      setMadeSummary(session.made_summary);
      setMadeReview(session.made_review);
      setPractice(session.practice_type);
      setTotal(session.questions_total?.toString() ?? "");
      setCorrect(session.questions_correct?.toString() ?? "");
      setNotes(session.notes ?? "");
    } else {
      setSubjectId(defaultSubjectId ?? null);
      setDate(todayISO());
      setHours("0");
      setMinutes("30");
      setMethod("");
      setMethodOther("");
      setMadeSummary(false);
      setMadeReview(false);
      setPractice("none");
      setTotal("");
      setCorrect("");
      setNotes("");
    }
  }, [open, session, defaultSubjectId]);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId) ?? null,
    [subjects, subjectId],
  );

  const filteredSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => s.name.toLowerCase().includes(q));
  }, [subjects, subjectSearch]);

  const exactMatch = subjects.some(
    (s) => s.name.trim().toLowerCase() === subjectSearch.trim().toLowerCase(),
  );

  const createSubjectMutation = useMutation({
    mutationFn: (name: string) => createSubject(name, subjects.length),
    onSuccess: async (subject) => {
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setSubjectId(subject.id);
      setSubjectOpen(false);
      setSubjectSearch("");
    },
    onError: () => toast.error("Não foi possível criar a matéria."),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: SessionPayload) => saveSession(payload, session?.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["subjects"] }),
      ]);
      toast.success(session ? "Sessão atualizada." : "Sessão registrada.");
      onOpenChange(false);
    },
    onError: () => toast.error("Não foi possível salvar a sessão."),
  });

  function validate(): SessionPayload | null {
    const next: Errors = {};
    const duration = (parseInt(hours || "0", 10) || 0) * 60 + (parseInt(minutes || "0", 10) || 0);

    if (!subjectId) next.subject = "Selecione uma matéria.";
    if (!date) next.date = "Informe a data.";
    else if (date > todayISO()) next.date = "A data não pode ser futura.";
    if (duration <= 0) next.duration = "O tempo de estudo deve ser maior que zero.";
    if (method === "outro" && !methodOther.trim())
      next.methodOther = "Descreva o método utilizado.";

    let totalNum: number | null = null;
    let correctNum: number | null = null;
    if (practice !== "none") {
      totalNum = total.trim() === "" ? NaN : Number(total);
      correctNum = correct.trim() === "" ? NaN : Number(correct);
      if (!Number.isFinite(totalNum) || (totalNum as number) <= 0)
        next.total = "Informe o total de questões (maior que zero).";
      if (!Number.isFinite(correctNum) || (correctNum as number) < 0)
        next.correct = "Informe os acertos.";
      else if (Number.isFinite(totalNum) && (correctNum as number) > (totalNum as number))
        next.correct = "Os acertos não podem ser maiores que o total.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return null;

    return {
      subject_id: subjectId!,
      session_date: date,
      duration_minutes: duration,
      study_method: method || null,
      study_method_other: method === "outro" ? methodOther.trim() : null,
      made_summary: madeSummary,
      made_review: madeReview,
      practice_type: practice,
      questions_total: practice === "none" ? null : (totalNum as number),
      questions_correct: practice === "none" ? null : (correctNum as number),
      notes: notes.trim() || null,
    };
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{session ? "Editar sessão de estudo" : "Nova sessão de estudo"}</DialogTitle>
          <DialogDescription>
            Registre o que você estudou, por quanto tempo e como foi seu desempenho.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Matéria</Label>
            <Popover open={subjectOpen} onOpenChange={setSubjectOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {selectedSubject ? selectedSubject.name : "Selecione ou crie uma matéria"}
                  <ChevronsUpDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar matéria..."
                    value={subjectSearch}
                    onValueChange={setSubjectSearch}
                  />
                  <CommandList>
                    {filteredSubjects.length === 0 && !subjectSearch.trim() && (
                      <CommandEmpty>Nenhuma matéria encontrada.</CommandEmpty>
                    )}
                    <CommandGroup>
                      {filteredSubjects.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.id}
                          onSelect={() => {
                            setSubjectId(s.id);
                            setSubjectOpen(false);
                          }}
                        >
                          <span
                            className="mr-2 size-2.5 rounded-full"
                            style={{ backgroundColor: s.color ?? "currentColor" }}
                          />
                          {s.name}
                          {s.id === subjectId && <Check className="ml-auto size-4" />}
                        </CommandItem>
                      ))}
                      {subjectSearch.trim() && !exactMatch && (
                        <CommandItem
                          value="__create__"
                          onSelect={() => createSubjectMutation.mutate(subjectSearch)}
                        >
                          <Plus className="mr-2 size-4" />
                          Criar matéria: "{subjectSearch.trim()}"
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-date">Data</Label>
            <Input
              id="session-date"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
            {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
          </div>

          <div className="space-y-2">
            <Label>Tempo de estudo</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                aria-label="Horas"
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">h</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                aria-label="Minutos"
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
            {errors.duration && <p className="text-sm text-destructive">{errors.duration}</p>}
          </div>

          <div className="space-y-2">
            <Label>Método de estudo</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um método" />
              </SelectTrigger>
              <SelectContent>
                {STUDY_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {method === "outro" && (
              <div className="space-y-1">
                <Input
                  placeholder="Qual método?"
                  value={methodOther}
                  onChange={(e) => setMethodOther(e.target.value)}
                />
                {errors.methodOther && (
                  <p className="text-sm text-destructive">{errors.methodOther}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="made-summary"
                checked={madeSummary}
                onCheckedChange={(v) => setMadeSummary(v === true)}
              />
              <Label htmlFor="made-summary" className="font-normal">
                Fiz um resumo do conteúdo
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="made-review"
                checked={madeReview}
                onCheckedChange={(v) => setMadeReview(v === true)}
              />
              <Label htmlFor="made-review" className="font-normal">
                Fiz revisão do conteúdo
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prática</Label>
            <RadioGroup
              value={practice}
              onValueChange={(v) => setPractice(v as PracticeType)}
              className="flex flex-wrap gap-4"
            >
              {[
                { value: "none", label: "Nenhuma" },
                { value: "questions", label: "Questões resolvidas" },
                { value: "simulado", label: "Simulado" },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`practice-${opt.value}`} />
                  <Label htmlFor={`practice-${opt.value}`} className="font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {practice !== "none" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="q-total">Total de questões</Label>
                  <Input
                    id="q-total"
                    type="number"
                    min={1}
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                  />
                  {errors.total && <p className="text-sm text-destructive">{errors.total}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="q-correct">Acertos</Label>
                  <Input
                    id="q-correct"
                    type="number"
                    min={0}
                    value={correct}
                    onChange={(e) => setCorrect(e.target.value)}
                  />
                  {errors.correct && <p className="text-sm text-destructive">{errors.correct}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saveMutation.isPending}
            onClick={() => {
              const payload = validate();
              if (payload) saveMutation.mutate(payload);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
