import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, LineChart, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controle de Frequência de Estudos" },
      {
        name: "description",
        content:
          "Registre suas sessões de estudo, acompanhe a frequência por matéria e o desempenho em questões e simulados.",
      },
      { property: "og:title", content: "Controle de Frequência de Estudos" },
      {
        property: "og:description",
        content: "Organize sua rotina de estudos com registros de tempo, resumos, revisões e práticas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Controle de estudos</h1>
      <p className="mt-3 text-muted-foreground">
        Registre cada sessão de estudo, acompanhe sua frequência por matéria e veja sua evolução em
        resumos, revisões e questões.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        <li className="rounded-xl border border-border p-4">
          <LineChart className="size-5 text-primary" />
          <p className="mt-2 text-sm font-medium">Frequência diária</p>
        </li>
        <li className="rounded-xl border border-border p-4">
          <BookOpen className="size-5 text-primary" />
          <p className="mt-2 text-sm font-medium">Estatísticas por matéria</p>
        </li>
        <li className="rounded-xl border border-border p-4">
          <ListChecks className="size-5 text-primary" />
          <p className="mt-2 text-sm font-medium">Questões e simulados</p>
        </li>
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button onClick={() => navigate({ to: "/auth" })}>Entrar</Button>
        <Button variant="outline" onClick={() => navigate({ to: "/auth" })}>
          Criar conta
        </Button>
      </div>
    </main>
  );
}
