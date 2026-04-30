"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEFAULT_SORT = "__default__";

export function TransactionAmountSortDropdown({
  selectedValue,
}: {
  selectedValue?: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());

        if (value === DEFAULT_SORT) {
          params.delete("amountSort");
        } else {
          params.set("amountSort", value);
        }

        const queryString = params.toString();
        router.push(queryString ? `${pathname}?${queryString}` : pathname);
      }}
      value={selectedValue ?? DEFAULT_SORT}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Sort amount" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_SORT}>Default order</SelectItem>
        <SelectItem value="asc">Amount: low to high</SelectItem>
        <SelectItem value="desc">Amount: high to low</SelectItem>
      </SelectContent>
    </Select>
  );
}
