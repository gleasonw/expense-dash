"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MovementHistoryList } from "./MovementHistoryList";
import { DeleteBucketButton } from "./DeleteBucketButton";
import { updateBucket } from "../bucket_actions";
import { MovementForm } from "./MovementForm";
import { MarkOngoingCompleteButton } from "./MarkOngoingCompleteButton";

type BucketCardProps = {
  bucket: any;
  movements: any[];
  savingsTarget: number;
};

export function BucketCard({
  bucket,
  movements,
  savingsTarget,
}: BucketCardProps) {
  const router = useRouter();
  const [showHistory, setShowHistory] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleRefresh = () => {
    router.refresh();
  };

  const totalAllocated = movements.reduce(
    (sum, m) => sum + parseFloat(m.amount),
    0
  );

  const isGoal = bucket.type === "goal";
  const targetAmount = parseFloat(bucket.targetAmount ?? "0");
  const targetPercentage = parseFloat(bucket.targetPercentage ?? "0");

  const isCompleted = isGoal
    ? totalAllocated >= targetAmount
    : Math.abs(totalAllocated - savingsTarget * targetPercentage) < 0.01;

  const progressPercent = isGoal
    ? Math.min((totalAllocated / targetAmount) * 100, 100)
    : 0;

  const handleArchive = async () => {
    if (!confirm("Archive this goal? It will be hidden from the main view.")) {
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

  const expectedMonthly = savingsTarget * targetPercentage;

  return (
    <div
      className={`p-5 rounded-lg border-2 shadow-sm ${
        isCompleted
          ? "bg-green-50 border-green-300"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {bucket.name}
            {isCompleted && <span className="text-2xl">🎉</span>}
          </h4>
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            {isGoal ? "Goal" : "Ongoing"}
          </p>
        </div>
      </div>

      {isGoal ? (
        <>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Progress</span>
              <span className="font-semibold text-gray-900">
                ${totalAllocated.toFixed(2)} / ${targetAmount.toFixed(2)}
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
                ✓ Goal Reached! Congratulations!
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleArchive}
                disabled={isArchiving}
                className="w-full"
              >
                {isArchiving ? "Archiving..." : "Archive This Goal"}
              </Button>
            </div>
          )}

          <MovementForm bucketId={bucket.id} />
        </>
      ) : (
        <>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Target</span>
              <span className="text-lg font-bold text-gray-900">
                {(targetPercentage * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Expected Monthly</span>
              <span className="font-semibold text-gray-900">
                ${expectedMonthly.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-gray-600">Current Total</span>
              <span className="font-semibold text-gray-900">
                ${totalAllocated.toFixed(2)}
              </span>
            </div>
          </div>

          {isCompleted ? (
            <div className="mb-3 p-2 bg-green-100 border border-green-300 rounded text-sm text-green-900 text-center">
              ✓ Complete for this month
            </div>
          ) : (
            <MarkOngoingCompleteButton
              bucketId={bucket.id}
              amount={expectedMonthly.toFixed(2)}
            />
          )}
        </>
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
