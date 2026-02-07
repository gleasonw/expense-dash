"use client";

import { createBucket } from "@/app/dashboard/bucket_actions";
import { PostBucket } from "@/server/schema";
import { useState, useTransition } from "react";

export function BucketForm() {
  const [formState, setFormState] = useState<Omit<PostBucket, "userId">>({
    name: "",
    targetAmount: null,
    autoAllocationPercent: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setFormState({
      name: "",
      targetAmount: null,
      autoAllocationPercent: null,
    });
    setFormError(null);
  }

  function setTargetAmount(value: string) {
    const amount = parseFloat(value);
    if (value.trim() === "") {
      setFormState({ ...formState, targetAmount: null });
      return;
    }
    if (!isNaN(amount) && amount >= 0) {
      setFormState({ ...formState, targetAmount: value });
    }
  }

  function setAllocationPercent(value: string) {
    if (value.trim() === "") {
      setFormState({ ...formState, autoAllocationPercent: null });
      return;
    }
    const percent = parseFloat(value);
    if (!isNaN(percent) && percent >= 0 && percent <= 1) {
      setFormState({ ...formState, autoAllocationPercent: value });
    }
  }

  return (
    <form
      className="flex flex-col gap-5 max-w-[300px] p-5 shadow-lg"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        if (!formState.name.trim()) {
          setFormError("Bucket name is required.");
          return;
        }
        if (formState.targetAmount) {
          const amount = parseFloat(formState.targetAmount);
          if (Number.isNaN(amount) || amount < 0) {
            setFormError("Target amount must be a positive number.");
            return;
          }
        }
        if (formState.autoAllocationPercent) {
          const percent = parseFloat(formState.autoAllocationPercent);
          if (Number.isNaN(percent) || percent < 0 || percent > 1) {
            setFormError("Auto-allocation percent must be between 0 and 1.");
            return;
          }
        }
        startTransition(() => {
          createBucket(formState).then((result) => {
            if (result?.success === false) {
              setFormError(result.message);
              return;
            }
            resetForm();
          });
        });
      }}
    >
      <input
        type="text"
        placeholder="Bucket Name"
        value={formState.name}
        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
      />
      <input
        type="text"
        placeholder="Target Amount (optional)"
        value={formState.targetAmount || ""}
        onChange={(e) => setTargetAmount(e.target.value)}
      />
      <input
        type="text"
        placeholder="Auto Allocation Percent (optional, 0-1)"
        value={formState.autoAllocationPercent || ""}
        onChange={(e) => setAllocationPercent(e.target.value)}
      />
      <button type="submit" className="p-2 bg-blue-500 text-white">
        {isPending ? "Creating..." : "Create Bucket"}
      </button>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <button type="button" className="p-2 bg-gray-300" onClick={resetForm}>
        Reset
      </button>
    </form>
  );
}
