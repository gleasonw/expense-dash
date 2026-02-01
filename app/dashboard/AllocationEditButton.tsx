"use client";

import React from "react";

import { useAllocationEditContext } from "./AllocationEditContext";
import { Button } from "@/components/ui/button";

export function AllocationEditButton() {
  const { isEditingAllocation, setIsEditingAllocation } =
    useAllocationEditContext();

  return (
    <Button
      variant={isEditingAllocation ? "default" : "outline"}
      onClick={() => setIsEditingAllocation(!isEditingAllocation)}
      className={isEditingAllocation ? "bg-blue-600 hover:bg-blue-700" : ""}
    >
      {isEditingAllocation ? "Done Editing" : "Edit Allocations"}
    </Button>
  );
}
