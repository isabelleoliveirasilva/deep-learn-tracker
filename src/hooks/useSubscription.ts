import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { checkSubscription } from "@/lib/stripe.functions";

export function useSubscription() {
  const check = useServerFn(checkSubscription);
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () => check(),
    staleTime: 60_000,
  });
}
