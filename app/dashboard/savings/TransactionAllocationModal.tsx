"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMovement } from "../bucket_actions";

type Bucket = {
  id: number;
  name: string;
  type: "goal" | "ongoing";
};

type AllocationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    transactionId: string;
    transactionName: string;
    transactionDate: string;
    unallocatedAmount: string;
  } | null;
  buckets: Bucket[];
  onSuccess: () => void;
};

type Allocation = {
  bucketId: number;
  amount: string;
};

export function TransactionAllocationModal({
  isOpen,
  onClose,
  transaction,
  buckets,
  onSuccess,
}: AllocationModalProps) {
  const router = useRouter();
  const [allocations, setAllocations] = useState<Allocation[]>([
    { bucketId: 0, amount: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!transaction) return null;

  const unallocated = parseFloat(transaction.unallocatedAmount);
  const totalAllocated = allocations.reduce(
    (sum, alloc) => sum + (parseFloat(alloc.amount) || 0),
    0
  );
  const remaining = unallocated - totalAllocated;

  const addAllocation = () => {
    setAllocations([...allocations, { bucketId: 0, amount: "" }]);
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const updateAllocation = (
    index: number,
    field: keyof Allocation,
    value: string | number
  ) => {
    const updated = [...allocations];
    const current = updated[index];
    if (!current) return;

    if (field === "bucketId") {
      updated[index] = { bucketId: value as number, amount: current.amount };
    } else {
      updated[index] = { bucketId: current.bucketId, amount: value as string };
    }
    setAllocations(updated);
  };

  const handleSubmit = async () => {
    setError(null);

    // Validate
    const validAllocations = allocations.filter(
      (a) => a.bucketId > 0 && parseFloat(a.amount) > 0
    );

    if (validAllocations.length === 0) {
      setError("Please add at least one allocation");
      return;
    }

    if (remaining < -0.01) {
      setError("Total allocations exceed available amount");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create all movements
      for (const allocation of validAllocations) {
        await createMovement({
          bucketId: allocation.bucketId,
          amount: allocation.amount,
          transactionId: transaction.transactionId,
          occurredAt: new Date(transaction.transactionDate),
          note: `Allocated from transaction`,
        });
      }

      onSuccess();
      router.refresh();
      onClose();
      // Reset state
      setAllocations([{ bucketId: 0, amount: "" }]);
    } catch (err) {
      setError("Failed to create allocations");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Allocate Transaction to Buckets</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-md">
            <p className="font-medium text-gray-900">
              {transaction.transactionName}
            </p>
            <p className="text-sm text-gray-600">
              {new Date(transaction.transactionDate).toLocaleDateString()}
            </p>
            <p className="text-lg font-semibold text-gray-900 mt-2">
              Available: ${transaction.unallocatedAmount}
            </p>
          </div>

          <div className="space-y-3">
            {allocations.map((allocation, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1">
                  <Select
                    value={allocation.bucketId.toString()}
                    onValueChange={(value) =>
                      updateAllocation(index, "bucketId", parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bucket" />
                    </SelectTrigger>
                    <SelectContent>
                      {buckets.map((bucket) => (
                        <SelectItem
                          key={bucket.id}
                          value={bucket.id.toString()}
                        >
                          {bucket.name} ({bucket.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-32">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={allocation.amount}
                    onChange={(e) =>
                      updateAllocation(index, "amount", e.target.value)
                    }
                  />
                </div>

                {allocations.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeAllocation(index)}
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
            <span className="text-sm font-medium text-blue-900">
              Allocated: ${totalAllocated.toFixed(2)} / $
              {unallocated.toFixed(2)}
            </span>
            <span
              className={`text-sm font-semibold ${
                remaining < -0.01
                  ? "text-red-600"
                  : remaining < 0.01
                  ? "text-green-600"
                  : "text-gray-700"
              }`}
            >
              Remaining: ${remaining.toFixed(2)}
            </span>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={addAllocation}
              className="flex-1"
            >
              + Add Another Bucket
            </Button>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Allocations"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
