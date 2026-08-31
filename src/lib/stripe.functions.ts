import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PREMIUM_PRICE_ID = "price_1UAVW4RzTpw1ZbcDIbzl6l6u";
export const PREMIUM_PRODUCT_ID = "prod_VArEcU9bUJ6Z3u";
export const FREE_SESSION_LIMIT = 10;

async function stripeClient() {
  const { default: Stripe } = await import("stripe");
  return new Stripe(process.env["STRIPE_SECRET_KEY"]!);
}

export type PremiumPlan = {
  name: string;
  description: string | null;
  amount: number | null;
  currency: string;
  interval: string | null;
  features: string[];
};

export const getPremiumPlan = createServerFn({ method: "GET" }).handler(
  async (): Promise<PremiumPlan | null> => {
    try {
      const stripe = await stripeClient();
      const price = await stripe.prices.retrieve(PREMIUM_PRICE_ID, { expand: ["product"] });
      const product = price.product as {
        name?: string;
        description?: string | null;
        marketing_features?: { name?: string }[];
      };
      return {
        name: product?.name ?? "Diário Premium",
        description: product?.description ?? null,
        amount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval ?? null,
        features: (product?.marketing_features ?? [])
          .map((f) => f.name ?? "")
          .filter((f) => f.length > 0),
      };
    } catch (error) {
      console.error("Stripe price fetch failed", error);
      return null;
    }
  },
);

export const checkSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string })?.email;
    if (!email) return { subscribed: false, subscription_end: null as string | null };

    const stripe = await stripeClient();
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];

    let subscribed = false;
    let subscriptionEnd: string | null = null;

    if (customer) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 10,
      });
      const active = subs.data.find((s) =>
        s.items.data.some((i) => i.price.id === PREMIUM_PRICE_ID),
      );
      if (active) {
        subscribed = true;
        const end = active.items.data[0]?.current_period_end;
        subscriptionEnd = end ? new Date(end * 1000).toISOString() : null;
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscribers").upsert(
      {
        user_id: context.userId,
        email,
        stripe_customer_id: customer?.id ?? null,
        subscribed,
        subscription_end: subscriptionEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return { subscribed, subscription_end: subscriptionEnd };
  });

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { origin: string }) => ({ origin: String(data.origin) }))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string })?.email;
    const stripe = await stripeClient();
    const customers = email ? await stripe.customers.list({ email, limit: 1 }) : null;
    const customer = customers?.data[0];

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(customer ? { customer: customer.id } : { customer_email: email }),
      line_items: [{ price: PREMIUM_PRICE_ID, quantity: 1 }],
      success_url: `${data.origin}/dashboard?checkout=success`,
      cancel_url: `${data.origin}/pricing?checkout=cancelled`,
    });

    return { url: session.url };
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { origin: string }) => ({ origin: String(data.origin) }))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string })?.email;
    if (!email) throw new Error("Sem e-mail na sessão");
    const stripe = await stripeClient();
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) throw new Error("Cliente Stripe não encontrado");
    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${data.origin}/dashboard`,
    });
    return { url: portal.url };
  });
