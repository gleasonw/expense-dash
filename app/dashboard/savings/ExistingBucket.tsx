"use client";

import { createMovement } from "@/app/dashboard/bucket_actions";
import { BucketWithMovements } from "@/app/dashboard/buckets_sdk";
import { useState } from "react";

export function ExistingBucket({ bucket }: { bucket: BucketWithMovements }) {
  const [movementAmount, setMovementAmount] = useState("");

  const totalAllocated = bucket.movements.reduce(
    (acc, movement) => acc + (parseInt(movement.amount) || 0),
    0
  );

  switch (bucket.type) {
    case "goal": {
      return (
        <div className="p-3 border rounded">
          <h2>{bucket.name}</h2>
          <div>
            {totalAllocated} / {bucket.targetAmount}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMovement({
                bucketId: bucket.id,
                amount: movementAmount,
              });
              setMovementAmount("");
            }}
          >
            <input
              type="text"
              value={movementAmount}
              onChange={(e) => setMovementAmount(e.target.value)}
              placeholder="Enter movement amount"
            />
            <button type="submit" disabled={!movementAmount}>
              {movementAmount ? "Add Movement" : "Enter Amount"}
            </button>
          </form>
        </div>
      );
    }
    case "ongoing": {
      return (
        <div className="p-3 border rounded">
          <h2>{bucket.name}</h2>
          {bucket.targetPercentage && <p>{bucket.targetPercentage}</p>}
          <div>
            Expected monthly movement <span>**mark as complete**</span>
          </div>
        </div>
      );
    }
    default: {
      const _exhaustiveCheck: never = bucket.type;
      throw new Error(`Unexpected bucket type: ${_exhaustiveCheck}`);
    }
  }
}
