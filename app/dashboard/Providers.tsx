"use client";

import { Tag } from "@/server/schema";
import { makeAutoObservable } from "mobx";
import React from "react";

class AppStore {
  constructor() {
    makeAutoObservable(this);
  }
}

const appStore = new AppStore();

export const AppStoreContext = React.createContext<AppStore | null>(null);

export const TagsContext = React.createContext<Tag[] | null>(null);

export function Providers({
  children,
  tags,
}: {
  children: React.ReactNode;
  tags: Tag[];
}) {
  return (
    <TagsContext.Provider value={tags}>
      <AppStoreContext.Provider value={appStore}>
        {children}
      </AppStoreContext.Provider>
    </TagsContext.Provider>
  );
}
