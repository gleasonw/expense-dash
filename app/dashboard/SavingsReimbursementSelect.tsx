"use client";

import { useTransition } from "react";
import { setSavingsReimbursement } from "@/app/dashboard/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SavingsReimbursementSelect({
  transactionId,
  isReimbursement,
}: {
  transactionId: string;
  isReimbursement: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <span>Credit type</span>
      <Select
        value={isReimbursement ? "savings-reimbursement" : "regular-credit"}
        disabled={isPending}
        onValueChange={(value) => {
          startTransition(() => {
            setSavingsReimbursement({
              transactionId,
              isReimbursement: value === "savings-reimbursement",
            });
          });
        }}
      >
        <SelectTrigger className="h-7 w-[180px] border-gray-200 bg-white text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="regular-credit">Regular credit</SelectItem>
          <SelectItem value="savings-reimbursement">
            Savings reimbursement
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
