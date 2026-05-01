"use client";

import { useState } from "react";
import { useAllocationEditContext } from "@/app/dashboard/AllocationEditContext";
import {
  deleteAllocationForTag,
  updateAllocationForTag,
} from "@/app/dashboard/tag_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AllocationEditControls({
  tagId,
  initialAllocation,
}: {
  tagId: string;
  initialAllocation: string;
}) {
  const { isEditingAllocation } = useAllocationEditContext();
  const [allocation, setAllocation] = useState(initialAllocation);
  const [isSaving, setIsSaving] = useState(false);

  if (!isEditingAllocation) {
    return null;
  }

  const hasChanged = allocation !== initialAllocation;

  async function onSave() {
    if (!hasChanged || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await updateAllocationForTag(tagId, allocation);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex items-center gap-2">
        <Input
          className="w-24 h-8 text-right"
          value={allocation}
          onChange={(event) => setAllocation(event.target.value)}
          aria-label="Allocation percentage"
        />
        <span className="text-xs text-gray-500">%</span>
      </div>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={!hasChanged || isSaving}
        >
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={() => deleteAllocationForTag(tagId)}>
          Delete
        </Button>
      </div>
    </div>
  );
}
