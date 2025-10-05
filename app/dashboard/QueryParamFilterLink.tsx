"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import React from "react";

export function QueryParamFilterLink({
  value,
  label,
  children,
}: {
  value: string;
  label: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={() => {
        const currentURL = new URL(window.location.href);
        currentURL.searchParams.set(label, value);
        router.push(currentURL.toString());
      }}
    >
      {children}
    </Button>
  );
}

// TODO
/**
 *
 *
 * import Link from 'next/link'

<Link href={{ query: { ...Object.fromEntries(searchParams), [filterKey]: filterValue } }}>
  {children}
</Link>
 */
