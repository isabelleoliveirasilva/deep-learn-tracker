import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SessionDialog } from "@/components/SessionDialog";
import {
  deleteSession,
  fetchSessions,
  fetchSubjects,
  formatDate,
  formatDuration,
  methodLabel,
  practiceLabel,
  type StudySession,
} from "@/lib/study";

export const Route = createFileRoute("/frequencia")({
  validateSearch: (search: Record<string, unknown>) => ({
    materia: typeof search["materia"] === "string" ? (search["materia"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Frequência por matéria | Controle de Estudos" },
      {
        name: "description",
        content:
          "Veja estatísticas por matéria: tempo total, número de sessões, resumos, revisões e taxa de acerto, com o histórico completo de sessões.",
      },
      { property: "og:title", content: "Frequência por matéria | Controle de Estudos" },
      {
        property: "og:description",
        content: "Estatísticas agregadas e histórico de sessões por matéria.",
      },
    ],
  }),
  component: FrequencyPage,
});

function FrequencyPage() {
  const search = Route.useSearch();
  const materia = search["materia"];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StudySession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudySession | null>(null);

  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const { data: sessions = [] } = useQuery({ queryKey: ["sessions"], queryFn: fetchSessions });

  const stats = useMemo(() => {
    return subjects
      .map((subject) => {
        const list = sessions.filter((s) => s.subject_id === subject.id);
        const practice = list.filter((s) => s.practice_type !== "none");
        const totalQ = practice.reduce((a, s) => a + (s.questions_total ?? 0), 0);
        const correctQ = practice.reduce((a, s) => a + (s.questions_correct ?? 0), 0);
        return {
          subject,
          sessions: list,
          count: list.length,
          minutes: list.reduce((a, s) => a + s.duration_minutes, 0),
          summaryPct: list.length
            ? Math.round((list.filter((s) => s.made_summary).length / list.length) * 100)
            : 0,
          reviewPct: list.length
            ? Math.round((list.filter((s) => s.made_review).length / list.length) * 100)
            : 0,
          accuracy: totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : null,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }, [subjects, sessions]);

  const selected = materia ? stats.find((s) => s.subject.id === materia) : undefined;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Sessão excluída.");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Não foi possível excluir a sessão."),
  });

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight">
            {selected ? selected.subject.name : "Frequência por matéria"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected
              ? "Histórico completo de sessões desta matéria."
              : "Estatísticas agregadas de todas as matérias."}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nova sessão de estudo
        </Button>
      </header>

      {!selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Todas as matérias</CardTitle>
            <CardDescription>Selecione uma matéria para ver o histórico.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matéria</TableHead>
                  <TableHead>Tempo total</TableHead>
                  <TableHead>Sessões</TableHead>
                  <TableHead>Resumos</TableHead>
                  <TableHead>Revisões</TableHead>
                  <TableHead>Acerto médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((row) => (
                  <TableRow
                    key={row.subject.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate({ to: "/frequencia", search: { materia: row.subject.id } })
                    }
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: row.subject.color ?? "currentColor" }}
                        />
                        {row.subject.name}
                      </span>
                    </TableCell>
                    <TableCell>{formatDuration(row.minutes)}</TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell>{row.count ? `${row.summaryPct}%` : "—"}</TableCell>
                    <TableCell>{row.count ? `${row.reviewPct}%` : "—"}</TableCell>
                    <TableCell>{row.accuracy !== null ? `${row.accuracy}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Tempo total", value: formatDuration(selected.minutes) },
              { label: "Sessões", value: String(selected.count) },
              { label: "Resumos", value: `${selected.summaryPct}%` },
              { label: "Revisões", value: `${selected.reviewPct}%` },
              {
                label: "Acerto médio",
                value: selected.accuracy !== null ? `${selected.accuracy}%` : "—",
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de sessões</CardTitle>
              <CardDescription>Da mais recente para a mais antiga.</CardDescription>
            </CardHeader>
            <CardContent>
              {selected.sessions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma sessão registrada para esta matéria.
                  </p>
                  <Button size="sm" onClick={openNew}>
                    <Plus className="size-4" />
                    Nova sessão
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selected.sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{formatDate(s.session_date)}</span>
                          <Badge variant="secondary">{formatDuration(s.duration_minutes)}</Badge>
                          <Badge variant="outline">{methodLabel(s)}</Badge>
                          {s.practice_type !== "none" && (
                            <Badge variant="secondary">{practiceLabel(s)}</Badge>
                          )}
                          {s.made_summary && <Badge>Resumo</Badge>}
                          {s.made_review && <Badge>Revisão</Badge>}
                        </div>
                        {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar sessão"
                          onClick={() => {
                            setEditing(s);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir sessão"
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <SessionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        subjects={subjects}
        session={editing}
        defaultSubjectId={selected?.subject.id ?? null}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A sessão de{" "}
              {deleteTarget ? formatDate(deleteTarget.session_date) : ""} será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
