"use client";

import { Button } from "@/components/ui/button";
import { Home, Menu, PiggyBank, Tag } from "lucide-react";
import Link from "next/link";
import React from "react";

export function NavMenu() {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!isExpanded) {
    return (
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(true)}
        className="absolute"
      >
        <Menu />
      </Button>
    );
  }
  return (
    <div className="absolute flex flex-col">
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(false)}
        aria-label="Collapse menu"
      >
        <Menu />
      </Button>
      <Link href="/dashboard">
        <button className="p-2 border hover:bg-gray-200" aria-label="Home">
          <Home />
        </button>
      </Link>
      <Link href="/dashboard/savings">
        <button className="p-2 border hover:bg-gray-200" aria-label="Savings">
          <PiggyBank />
        </button>
      </Link>
      <Link href="/dashboard/tags">
        <button className="p-2 border hover:bg-gray-200" aria-label="Tags">
          <Tag />
        </button>
      </Link>
    </div>
  );
}
