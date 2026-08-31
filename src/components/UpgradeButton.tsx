import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";

export function UpgradeButton() {
  const { data } = useSubscription();
  if (data?.subscribed) {
    return (
      <span className="hidden items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">
        <Sparkles className="size-3.5" />
        Premium
      </span>
    );
  }
  return (
    <Button asChild size="sm">
      <Link to="/pricing">
        <Sparkles className="size-4" />
        Upgrade
      </Link>
    </Button>
  );
}
