"use client";

import { TransactionTag } from "@/app/dashboard/types";
import { makeAutoObservable } from "mobx";
import React from "react";

class AppStore {
  constructor() {
    makeAutoObservable(this);
  }
}

const appStore = new AppStore();

export const AppStoreContext = React.createContext<AppStore | null>(null);

export const TagsContext = React.createContext<TransactionTag[] | null>(null);

export function Providers({
  children,
  tags,
}: {
  children: React.ReactNode;
  tags: TransactionTag[];
}) {
  return (
    <TagsContext.Provider value={tags}>
      <AppStoreContext.Provider value={appStore}>
        {children}
      </AppStoreContext.Provider>
    </TagsContext.Provider>
  );
}
