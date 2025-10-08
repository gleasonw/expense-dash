"use client";

import React from "react";

import { useAllocationEditContext } from "./AllocationEditContext";
import { Button } from "@/components/ui/button";

export function AllocationEditButton() {
  const { isEditingAllocation, setIsEditingAllocation } =
    useAllocationEditContext();

  return (
    <Button
      variant="outline"
      onClick={() => setIsEditingAllocation(!isEditingAllocation)}
    >
      {isEditingAllocation ? "Done" : "Edit"}
    </Button>
  );
}
