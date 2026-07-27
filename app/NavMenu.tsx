import { Button } from "@/components/ui/button";
import { Home, PiggyBank, Tag } from "lucide-react";
import Link from "next/link";

export function NavMenu() {
  return (
    <aside className="flex-row flex gap-3 ">
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
