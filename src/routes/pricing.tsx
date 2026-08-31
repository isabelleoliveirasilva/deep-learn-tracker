import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { createCheckout, FREE_SESSION_LIMIT, getPremiumPlan } from "@/lib/stripe.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Planos e Preços | Controle de Estudos" },
      {
        name: "description",
        content:
          "Compare o plano gratuito com o Diário Premium: sessões de estudo ilimitadas, histórico completo e estatísticas por matéria.",
      },
      { property: "og:title", content: "Planos e Preços | Controle de Estudos" },
      {
        property: "og:description",
        content: "Escolha entre o plano gratuito e o Diário Premium mensal com sessões ilimitadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function formatPrice(amount: number | null, currency: string) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function PricingPage() {
  const navigate = useNavigate();
  const loadPlan = useServerFn(getPremiumPlan);
  const checkout = useServerFn(createCheckout);

  const { data: plan, isLoading } = useQuery({
    queryKey: ["premium-plan"],
    queryFn: () => loadPlan(),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth" });
        return null;
      }
      return checkout({ data: { origin: window.location.origin } });
    },
    onSuccess: (result) => {
      if (result?.url) window.location.href = result.url;
    },
    onError: () => toast.error("Não foi possível iniciar o checkout. Tente novamente."),
  });

  const premiumFeatures =
    plan?.features.length && plan.features.length > 0
      ? plan.features
      : [
          "Cadastro ilimitado de sessões de estudo",
          "Histórico completo sem limite",
          "Estatísticas por matéria",
          "Gráficos de frequência",
        ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Escolha seu plano</h1>
        <p className="mt-3 text-muted-foreground">
          Comece de graça e faça upgrade quando precisar registrar mais estudos.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gratuito</CardTitle>
            <CardDescription>Para começar a organizar sua rotina</CardDescription>
            <p className="pt-2 text-3xl font-bold">R$ 0</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {[
                `Até ${FREE_SESSION_LIMIT} sessões de estudo por mês`,
                "Dashboard com gráfico de frequência",
                "Frequência por matéria",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="w-full">
              <Link to="/dashboard">Continuar no gratuito</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              {plan?.name ?? "Diário Premium"}
            </CardTitle>
            <CardDescription>
              {plan?.description ?? "Sessões de estudo ilimitadas, todo mês."}
            </CardDescription>
            <p className="pt-2 text-3xl font-bold">
              {isLoading ? "Carregando..." : formatPrice(plan?.amount ?? null, plan?.currency ?? "brl")}
              {plan?.interval && (
                <span className="text-base font-normal text-muted-foreground">
                  /{plan.interval === "month" ? "mês" : plan.interval}
                </span>
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {premiumFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="w-full"
              disabled={checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate()}
            >
              {checkoutMutation.isPending ? "Redirecionando..." : "Assinar Premium"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
