"use client";

import { useState } from "react";
import { useAllocationEditContext } from "@/app/dashboard/AllocationEditContext";
import {
  deleteAllocationForTag,
  updateAllocationForTag,
} from "@/app/dashboard/tag_actions";
import type { TagAllocationType } from "@/app/dashboard/tag_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AllocationEditControls({
  tagId,
  initialAllocation,
  initialAllocationType,
}: {
  tagId: string;
  initialAllocation: string;
  initialAllocationType: TagAllocationType;
}) {
  const { isEditingAllocation } = useAllocationEditContext();
  const [allocation, setAllocation] = useState(initialAllocation);
  const [allocationType, setAllocationType] = useState(initialAllocationType);
  const [isSaving, setIsSaving] = useState(false);

  if (!isEditingAllocation) {
    return null;
  }

  const hasChanged =
    allocation !== initialAllocation || allocationType !== initialAllocationType;

  async function onSave() {
    if (!hasChanged || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await updateAllocationForTag({ tagId, allocation, allocationType });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <select
        value={allocationType}
        onChange={(event) =>
          setAllocationType(event.target.value as TagAllocationType)
        }
        className="h-8 rounded border border-gray-200 bg-white px-2 text-xs"
        aria-label="Allocation type"
      >
        <option value="percent">Percent</option>
        <option value="fixed">Fixed</option>
      </select>
      <div className="flex items-center gap-2">
        {allocationType === "fixed" && (
          <span className="text-xs text-gray-500">$</span>
        )}
        <Input
          className="w-24 h-8 text-right"
          value={allocation}
          onChange={(event) => setAllocation(event.target.value)}
          aria-label={
            allocationType === "fixed"
              ? "Fixed allocation amount"
              : "Allocation percentage"
          }
        />
        {allocationType === "percent" && (
          <span className="text-xs text-gray-500">%</span>
        )}
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteAllocationForTag(tagId)}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
