"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBucket } from "../bucket_actions";

type BucketForEdit = {
  id: number;
  name: string;
  targetAmount: string | null;
  autoAllocationPercent: string | null;
};

export function BucketEditForm({
  bucket,
  onCancel,
  onSaved,
}: {
  bucket: BucketForEdit;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(bucket.name);
  const [targetAmount, setTargetAmount] = useState(
    bucket.targetAmount ?? ""
  );
  const [autoAllocationPercent, setAllocationPercent] = useState(
    bucket.autoAllocationPercent ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validate = () => {
    if (!name.trim()) {
      return "Bucket name is required.";
    }
    if (targetAmount) {
      const amount = parseFloat(targetAmount);
      if (Number.isNaN(amount) || amount < 0) {
        return "Target amount must be a positive number.";
      }
    }
    if (autoAllocationPercent) {
      const percent = parseFloat(autoAllocationPercent);
      if (Number.isNaN(percent) || percent < 0 || percent > 1) {
        return "Auto-allocation percent must be between 0 and 1.";
      }
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    const updates = {
      name: name.trim(),
      targetAmount: targetAmount || null,
      autoAllocationPercent: autoAllocationPercent || null,
    };
    const result = await updateBucket(bucket.id, updates);
    setIsSaving(false);

    if (result?.success === false) {
      setError(result.message);
      return;
    }

    onSaved();
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">
          Name
          <Input
            className="mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="text-sm font-medium text-gray-700">
          Target Amount (optional)
          <Input
            className="mt-1"
            inputMode="decimal"
            value={targetAmount}
            onChange={(event) => setTargetAmount(event.target.value)}
          />
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium text-gray-700">
        Auto Allocation Percent (optional)
        <Input
          className="mt-1"
          inputMode="decimal"
          value={autoAllocationPercent}
          onChange={(event) => setAllocationPercent(event.target.value)}
        />
      </label>

      <p className="mt-2 text-xs text-gray-500">
        Percentages are stored as decimals between 0 and 1 (for example 0.25 for
        25%).
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          size="sm"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
