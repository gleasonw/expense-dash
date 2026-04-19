"use client";

import { createAllocationForTag } from "@/app/dashboard/tag_actions";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function CreateAllocationForm({
  tags,
  remainingPercent,
}: {
  tags: Array<{ id: string; tag: string }>;
  remainingPercent: number;
}) {
  const [show, setShow] = useState(false);
  const [tagId, setTagId] = useState("");
  const [allocation, setAllocation] = useState("");
  const allocationValue = parseFloat(allocation);
  const isValidAllocation = !Number.isNaN(allocationValue);
  const remainingAfterInput = isValidAllocation
    ? remainingPercent - allocationValue
    : remainingPercent;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tagId || !allocation) return;
    createAllocationForTag({ tag_id: tagId, allocation });
  }

  if (!show) {
    return (
      <Button
        variant="default"
        onClick={() => setShow(true)}
        className="bg-blue-600 text-white rounded px-6 py-2 hover:bg-blue-700 max-w-sm flex items-center gap-2"
      >
        <span className="text-xl">+</span>
        <span>New Budget Allocation</span>
      </Button>
    );
  }

  return (
    <div className="">
      <Button
        variant="ghost"
        onClick={() => setShow(false)}
        className="mb-4 text-gray-500 hover:underline"
      >
        Cancel
      </Button>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 p-4 max-w-sm"
      >
        <label className="flex flex-col">
          <span className="mb-1 font-medium">Tag</span>
          <select
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
            className="border rounded p-2"
            required
          >
            <option value="">Select a tag</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tag}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1 font-medium">Allocation</span>
          <input
            type="number"
            step="0.01"
            value={allocation}
            onChange={(e) => setAllocation(e.target.value)}
            className="border rounded p-2"
            required
          />
          <span className="mt-1 text-xs text-gray-500">
            {isValidAllocation
              ? `${remainingAfterInput.toFixed(2)}% remaining after this allocation`
              : `${remainingPercent.toFixed(2)}% remaining from 100%`}
          </span>
        </label>

        <Button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          Create Allocation
        </Button>
      </form>
    </div>
  );
}
