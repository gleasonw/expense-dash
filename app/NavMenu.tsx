import { Button } from "@/components/ui/button";
import { Home, PiggyBank, Tag } from "lucide-react";
import Link from "next/link";

export function NavMenu() {
  return (
    <aside className="flex h-full w-14 flex-col items-center gap-3 border-r bg-white/70 px-2 py-4">
      <Button variant="ghost" size="icon" asChild>
        <Link href="/dashboard" aria-label="Home">
          <Home />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" asChild>
        <Link href="/dashboard/savings" aria-label="Savings">
          <PiggyBank />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" asChild>
        <Link href="/dashboard/tags" aria-label="Tags">
          <Tag />
        </Link>
      </Button>
    </aside>
  );
}
