"use client";

import { createBucket } from "@/app/dashboard/bucket_actions";
import { PostBucket } from "@/server/schema";
import { useState, useTransition } from "react";

export function BucketForm() {
  const [formState, setFormState] = useState<Omit<PostBucket, "userId">>({
    name: "",
    targetAmount: null,
    targetPercentage: null,
    type: "goal",
  });
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setFormState({
      name: "",
      targetAmount: null,
      targetPercentage: null,
      type: "goal",
    });
  }

  function setTargetAmount(value: string) {
    const amount = parseFloat(value);
    if (formState.type === "ongoing") {
      return;
    }
    if (!isNaN(amount) && amount >= 0) {
      setFormState({ ...formState, targetAmount: value });
    }
  }

  function setTargetPercentage(value: string) {
    if (formState.type === "goal") {
      return;
    }
    setFormState({ ...formState, targetPercentage: value });
  }

  function setType(type: string) {
    if (type !== "goal" && type !== "ongoing") {
      return;
    }
    switch (type) {
      case "goal":
        setFormState({ ...formState, targetPercentage: null, type: "goal" });
        break;
      case "ongoing":
        setFormState({ ...formState, targetAmount: null, type: "ongoing" });
        break;
      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unexpected bucket type: ${_exhaustiveCheck}`);
      }
    }
  }

  return (
    <form
      className="flex flex-col gap-5 max-w-[300px] p-5 shadow-lg"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => {
          createBucket(formState);
        });
        resetForm();
      }}
    >
      <input
        type="text"
        placeholder="Bucket Name"
        value={formState.name}
        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
      />
      <select value={formState.type} onChange={(e) => setType(e.target.value)}>
        <option value="goal">Goal</option>
        <option value="ongoing">Ongoing</option>
      </select>
      {formState.type === "goal" ? (
        <input
          type="text"
          placeholder="Target Amount"
          value={formState.targetAmount || ""}
          onChange={(e) => setTargetAmount(e.target.value)}
        />
      ) : (
        <input
          type="text"
          placeholder="Target Percentage"
          value={formState.targetPercentage || ""}
          onChange={(e) => setTargetPercentage(e.target.value)}
        />
      )}
      <button type="submit" className="p-2 bg-blue-500 text-white">
        {isPending ? "Creating..." : "Create Bucket"}
      </button>
      <button type="button" className="p-2 bg-gray-300" onClick={resetForm}>
        Reset
      </button>
    </form>
  );
}
