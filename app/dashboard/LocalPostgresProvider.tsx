"use client";

import { PGlite } from "@electric-sql/pglite";
import { PGliteProvider } from "@electric-sql/pglite-react";
import { live } from "@electric-sql/pglite/live";
import { makeAutoObservable, ObservableMap } from "mobx";
import { makePersistable } from "mobx-persist-store";
import React from "react";

const db = await PGlite.create("idb://expense-dash", { extensions: { live } });

async function initTransactionsTable() {
  console.log("init transactions table");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      account_id VARCHAR(255) NOT NULL,
      amount DECIMAL NOT NULL,
      iso_currency_code VARCHAR(3) NULL,
      unofficial_currency_code VARCHAR(255) NULL,
      category TEXT[] NULL,
      category_id VARCHAR(255) NULL,
      check_number VARCHAR(255) NULL,
      date DATE NOT NULL,
      location JSONB NOT NULL,
      name VARCHAR(255) NOT NULL,
      merchant_name VARCHAR(255) NULL,
      original_description TEXT NULL,
      payment_meta JSONB NOT NULL,
      pending BOOLEAN NOT NULL,
      pending_transaction_id VARCHAR(255) NULL,
      account_owner VARCHAR(255) NULL,
      transaction_id VARCHAR(255) PRIMARY KEY,
      transaction_type VARCHAR(255) NULL,
      logo_url VARCHAR(255) NULL,
      website VARCHAR(255) NULL,
      authorized_date DATE NULL,
      authorized_datetime TIMESTAMP WITH TIME ZONE NULL,
      datetime TIMESTAMP WITH TIME ZONE NULL,
      payment_channel VARCHAR(255) NOT NULL,
      personal_finance_category JSONB NULL,
      transaction_code JSONB NULL,
      personal_finance_category_icon_url VARCHAR(255) NULL,
      merchant_entity_id VARCHAR(255) NULL
    );
    `);
}

initTransactionsTable();

window["db"] = db;

class AppStore {
  transactionTags = new ObservableMap<
    string,
    "expenses" | "income" | "discretionary"
  >();

  constructor() {
    makeAutoObservable(this);

    // todo: we should probably move this to the global db at some point, just to handle sync to other accounts/devices
    makePersistable(this, {
      name: "AppStore",
      properties: ["transactionTags"],
      storage: window.localStorage,
    });
  }

  markTransaction(id: string, tag: "expenses" | "income" | "discretionary") {
    this.transactionTags.set(id, tag);
  }
}

const appStore = new AppStore();

export const AppStoreContext = React.createContext<AppStore | null>(null);

export function LocalPostgresProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppStoreContext.Provider value={appStore}>
      <PGliteProvider db={db}>{children}</PGliteProvider>
    </AppStoreContext.Provider>
  );
}
