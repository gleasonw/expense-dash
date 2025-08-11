"use client";
import { deleteBucket } from "@/app/dashboard/bucket_actions";

export function DeleteBucketButton({ bucketId }: { bucketId: number }) {
  return (
    <button
      className="absolute top-0 right-0"
      onClick={() => deleteBucket(bucketId)}
    >
      X
    </button>
  );
}
