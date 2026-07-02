"use client";

import { useTransition } from "react";
import { setTransactionBucketFunding } from "@/app/dashboard/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BucketOption = {
  id: number;
  name: string;
  color: string | null;
};

export function FundedByBucketSelect({
  transactionId,
  buckets,
  selectedBucketId,
}: {
  transactionId: string;
  buckets: BucketOption[];
  selectedBucketId?: number | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <span>Funded by</span>
      <Select
        value={selectedBucketId ? String(selectedBucketId) : "monthly-budget"}
        disabled={isPending}
        onValueChange={(value) => {
          startTransition(() => {
            setTransactionBucketFunding({
              transactionId,
              bucketId: value === "monthly-budget" ? null : Number(value),
            });
          });
        }}
      >
        <SelectTrigger className="h-7 w-[170px] border-gray-200 bg-white text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly-budget">Monthly budget</SelectItem>
          {buckets.map((bucket) => (
            <SelectItem key={bucket.id} value={String(bucket.id)}>
              {bucket.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
