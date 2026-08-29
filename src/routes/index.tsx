import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BookOpen, CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionDialog } from "@/components/SessionDialog";
import {
  fetchSessions,
  fetchSubjects,
  formatDate,
  formatDuration,
  practiceLabel,
  type StudySession,
} from "@/lib/study";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard de Estudos | Controle de Frequência" },
      {
        name: "description",
        content:
          "Acompanhe sua rotina de estudos: minutos por dia, matérias recentes, resumos, revisões e desempenho em questões e simulados.",
      },
      { property: "og:title", content: "Dashboard de Estudos | Controle de Frequência" },
      {
        property: "og:description",
        content: "Registre sessões de estudo e visualize sua frequência ao longo do tempo.",
      },
    ],
  }),
  component: Dashboard,
});

const RANGES = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "all", label: "Tudo" },
];

function isoMinusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function weekStart(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() - date.getDay());
  return date.toISOString().slice(0, 10);
}

function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState("30");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
  });

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s] as const)),
    [subjects],
  );

  const filtered = useMemo(() => {
    if (range === "all") return sessions;
    const from = isoMinusDays(Number(range) - 1);
    return sessions.filter((s) => s.session_date >= from);
  }, [sessions, range]);

  const chartData = useMemo(() => {
    if (filtered.length === 0) return [];
    const dates = filtered.map((s) => s.session_date).sort();
    const first = dates[0] ?? "";
    const last = dates[dates.length - 1] ?? "";
    const spanDays = (new Date(last).getTime() - new Date(first).getTime()) / 86400000;
    const groupByWeek = range === "all" ? spanDays > 60 : Number(range) > 60;

    const map = new Map<string, number>();
    for (const s of filtered) {
      const key = groupByWeek ? weekStart(s.session_date) : s.session_date;
      map.set(key, (map.get(key) ?? 0) + s.duration_minutes);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, minutes]) => ({
        key,
        label: groupByWeek ? `Sem. ${formatDate(key)}` : formatDate(key).slice(0, 5),
        minutes,
      }));
  }, [filtered, range]);

  const recentSubjects = useMemo(() => {
    const bySubject = new Map<string, { last: StudySession; total: number }>();
    for (const s of sessions) {
      const entry = bySubject.get(s.subject_id);
      if (!entry) {
        bySubject.set(s.subject_id, { last: s, total: s.duration_minutes });
      } else {
        entry.total += s.duration_minutes;
        if (s.session_date > entry.last.session_date) entry.last = s;
      }
    }
    return [...bySubject.values()]
      .sort((a, b) => b.last.session_date.localeCompare(a.last.session_date))
      .slice(0, 5);
  }, [sessions]);

  const totalMinutes = filtered.reduce((acc, s) => acc + s.duration_minutes, 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Controle de estudos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe sua frequência, resumos, revisões e desempenho.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/frequencia" search={{ materia: undefined }}>
              <BookOpen className="size-4" />
              Frequência por matéria
            </Link>
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Nova sessão de estudo
          </Button>
        </div>
      </header>

      <Card className="mb-6">
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Frequência de estudo</CardTitle>
            <CardDescription>
              {filtered.length > 0
                ? `${formatDuration(totalMinutes)} no período selecionado`
                : "Minutos estudados por período"}
            </CardDescription>
          </div>
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r.value} value={r.value}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <CalendarDays className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum estudo registrado ainda</p>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Registrar primeira sessão
              </Button>
            </div>
          ) : chartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma sessão neste período.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -16, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="freq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      color: "var(--color-popover-foreground)",
                    }}
                    formatter={(value) => [formatDuration(Number(value)), "Estudado"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#freq)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas matérias</CardTitle>
          <CardDescription>As matérias com sessões mais recentes.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSubjects.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma matéria estudada ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matéria</TableHead>
                  <TableHead>Última sessão</TableHead>
                  <TableHead>Tempo total</TableHead>
                  <TableHead>Última prática</TableHead>
                  <TableHead>Resumo / Revisão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSubjects.map(({ last, total }) => {
                  const subject = subjectById.get(last.subject_id);
                  return (
                    <TableRow
                      key={last.subject_id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate({
                          to: "/frequencia",
                          search: { materia: last.subject_id },
                        })
                      }
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: subject?.color ?? "currentColor" }}
                          />
                          {subject?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(last.session_date)}</TableCell>
                      <TableCell>{formatDuration(total)}</TableCell>
                      <TableCell>{practiceLabel(last)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={last.made_summary ? "default" : "outline"}>Resumo</Badge>
                          <Badge variant={last.made_review ? "default" : "outline"}>Revisão</Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SessionDialog open={dialogOpen} onOpenChange={setDialogOpen} subjects={subjects} />
    </div>
  );
}
