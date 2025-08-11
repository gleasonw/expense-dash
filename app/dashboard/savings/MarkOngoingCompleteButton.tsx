"use client";

import { createMovement } from "@/app/dashboard/bucket_actions";

export function MarkOngoingCompleteButton({
  bucketId,
  amount,
}: {
  bucketId: number;
  amount: string;
}) {
  return (
    <button onClick={() => createMovement({ bucketId, amount })}>
      Mark Ongoing Complete
    </button>
  );
}
