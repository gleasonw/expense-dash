"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MovementHistoryList } from "./MovementHistoryList";
import { DeleteBucketButton } from "./DeleteBucketButton";
import { updateBucket } from "../bucket_actions";
import { BucketEditForm } from "./BucketEditForm";
import type { BucketWithMovements } from "../buckets_sdk";
import { Button } from "@/components/ui/button";

type Movement = {
  id: number;
  amount: string;
  note: string | null;
  transactionId: string | null;
  occurredAt: Date;
  isOrphaned?: boolean;
};

type BucketCardProps = {
  bucket: BucketWithMovements;
  movements: Movement[];
};

export function BucketCard({ bucket, movements }: BucketCardProps) {
  const router = useRouter();
  const [showHistory, setShowHistory] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleRefresh = () => {
    router.refresh();
  };

  const totalAllocated = movements.reduce(
    (sum, m) => sum + parseFloat(m.amount),
    0
  );

  const targetAmountValue =
    bucket.targetAmount === null || bucket.targetAmount === undefined
      ? null
      : parseFloat(bucket.targetAmount);
  const hasTarget =
    targetAmountValue !== null &&
    !Number.isNaN(targetAmountValue) &&
    targetAmountValue > 0;
  const autoAllocationPercent = parseFloat(bucket.autoAllocationPercent ?? "0");
  const hasAllocationPercent = autoAllocationPercent > 0;

  const isCompleted = hasTarget
    ? totalAllocated >= (targetAmountValue ?? 0)
    : false;

  const progressPercent = hasTarget
    ? Math.min((totalAllocated / (targetAmountValue ?? 1)) * 100, 100)
    : 0;

  const handleArchive = async () => {
    if (
      !confirm("Archive this bucket? It will be hidden from the main view.")
    ) {
      return;
    }

    setIsArchiving(true);
    try {
      await updateBucket(bucket.id, { isArchived: true });
      handleRefresh();
    } catch (err) {
      console.error("Failed to archive bucket", err);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div
      className={`p-5 rounded-lg border-2 shadow-sm relative ${
        isCompleted
          ? "bg-green-50 border-green-300"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {bucket.name}
            {isCompleted && <span className="text-2xl">🎉</span>}
          </h4>
          {hasAllocationPercent && (
            <p className="text-xs text-gray-500 mt-1">
              Auto allocation: {(autoAllocationPercent * 100).toFixed(1)}%
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? "Close" : "Edit"}
        </Button>
      </div>

      {isEditing && (
        <BucketEditForm
          bucket={{
            id: bucket.id,
            name: bucket.name,
            targetAmount: bucket.targetAmount ?? null,
            autoAllocationPercent: bucket.autoAllocationPercent ?? null,
          }}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            handleRefresh();
          }}
        />
      )}

      {!isEditing && hasTarget ? (
        <>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Progress</span>
              <span className="font-semibold text-gray-900">
                ${totalAllocated.toFixed(2)} / $
                {(targetAmountValue ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isCompleted ? "bg-green-500" : "bg-blue-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {isCompleted && (
            <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-md">
              <p className="text-sm font-medium text-green-900 mb-2">
                ✓ Target Reached! Great work.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleArchive}
                disabled={isArchiving}
                className="w-full"
              >
                {isArchiving ? "Archiving..." : "Archive Bucket"}
              </Button>
            </div>
          )}
        </>
      ) : (
        !isEditing && (
          <>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Current Total</span>
                <span className=" font-bold text-gray-900">
                  ${totalAllocated.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span>Movement History ({movements.length})</span>
          <span className="text-lg">{showHistory ? "▼" : "▶"}</span>
        </button>

        {showHistory && (
          <div className="mt-3">
            <MovementHistoryList
              movements={movements}
              onMovementDeleted={handleRefresh}
            />
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <DeleteBucketButton bucketId={bucket.id} />
      </div>
    </div>
  );
}
