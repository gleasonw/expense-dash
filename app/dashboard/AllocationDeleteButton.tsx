"use client";

import { useAllocationEditContext } from "@/app/dashboard/AllocationEditContext";
import { deleteAllocationForTag } from "@/app/dashboard/tag_actions";
import { Button } from "@/components/ui/button";

export function AllocationDeleteButton({ tagId }: { tagId: string }) {
  const { isEditingAllocation } = useAllocationEditContext();
  if (!isEditingAllocation) {
    return null;
  }
  return (
    <Button variant="ghost" onClick={() => deleteAllocationForTag(tagId)}>
      X
    </Button>
  );
}
