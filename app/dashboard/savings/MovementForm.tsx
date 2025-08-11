"use client";

import { createMovement } from "@/app/dashboard/bucket_actions";
import { useState } from "react";

export function MovementForm({ bucketId }: { bucketId: number }) {
  const [movementAmount, setMovementAmount] = useState("");

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        createMovement({
          bucketId: bucketId,
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
  );
}
