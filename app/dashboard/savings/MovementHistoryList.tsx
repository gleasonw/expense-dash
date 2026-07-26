"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteMovement } from "../bucket_actions";

type Movement = {
  id: number;
  amount: string;
  note: string | null;
  transactionId: string | null;
  occurredAt: Date;
  isOrphaned?: boolean;
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

export function MovementHistoryList({
  movements,
  onMovementDeleted,
}: {
  movements: Movement[];
  onMovementDeleted: () => void;
}) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (movementId: number) => {
    if (!confirm("Delete this movement?")) return;

    setDeletingId(movementId);
    try {
      await deleteMovement(movementId);
      onMovementDeleted();
    } catch (err) {
      console.error("Failed to delete movement", err);
    } finally {
      setDeletingId(null);
    }
  };

  if (movements.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic py-2">No movements yet</p>
    );
  }

  // Group by month
  const groupedByMonth = movements.reduce((acc, movement) => {
    const month = new Date(movement.occurredAt).toISOString().slice(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(movement);
    return acc;
  }, {} as Record<string, Movement[]>);

  const sortedMonths = Object.keys(groupedByMonth).sort().reverse();

  return (
    <div className="space-y-4">
      {sortedMonths.map((month) => {
        const monthMovements = groupedByMonth[month] || [];
        const monthTotal = monthMovements.reduce(
          (sum, m) => sum + parseFloat(m.amount),
          0
        );

        return (
          <div key={month} className="border-l-2 border-gray-200 pl-3">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-sm text-gray-700">
                {monthFormatter.format(new Date(`${month}-01T00:00:00Z`))}
              </h4>
              <span className="text-sm font-semibold text-gray-900">
                {monthTotal < 0 ? "-" : ""}${Math.abs(monthTotal).toFixed(2)}
              </span>
            </div>

            <div className="space-y-2">
              {monthMovements.map((movement) => {
                const amount = parseFloat(movement.amount);
                const isDrawdown = amount < 0;
                return (
                  <div
                    key={movement.id}
                    className={`flex items-start justify-between py-2 px-3 rounded-md text-sm ${
                      isDrawdown ? "bg-amber-50" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">
                          {dayFormatter.format(new Date(movement.occurredAt))}
                        </span>
                        {movement.transactionId && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              isDrawdown
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {isDrawdown ? "Funded spending" : "Transaction"}
                          </span>
                        )}
                        {movement.isOrphaned && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                            Orphaned
                          </span>
                        )}
                      </div>
                      {movement.note && (
                        <p className="text-xs text-gray-500 mt-1">
                          {movement.note}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-medium ${
                          isDrawdown ? "text-amber-800" : "text-gray-900"
                        }`}
                      >
                        {amount < 0 ? "-" : ""}${Math.abs(amount).toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(movement.id)}
                        disabled={deletingId === movement.id}
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {deletingId === movement.id ? "..." : "✕"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
