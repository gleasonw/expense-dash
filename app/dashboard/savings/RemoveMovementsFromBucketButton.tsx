"use client";

import { removeMovementsFromBucket } from "@/app/dashboard/bucket_actions";

export function RemoveMovementsFromBucketButton({
  bucketId,
}: {
  bucketId: number;
}) {
  return (
    <button
      onClick={() => removeMovementsFromBucket(bucketId)}
      className="border"
    >
      Remove Movements / mark uncomplete
    </button>
  );
}
