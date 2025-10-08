"use client";

import React from "react";

const EditContext = React.createContext<{
  isEditingAllocation: boolean;
  setIsEditingAllocation: React.Dispatch<React.SetStateAction<boolean>>;
}>({
  isEditingAllocation: false,
  setIsEditingAllocation: () => {},
});

export const useAllocationEditContext = () => React.useContext(EditContext);

export function AllocationEditContext({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isEditingAllocation, setIsEditingAllocation] = React.useState(false);
  return (
    <EditContext.Provider
      value={{ isEditingAllocation, setIsEditingAllocation }}
    >
      {children}
    </EditContext.Provider>
  );
}
