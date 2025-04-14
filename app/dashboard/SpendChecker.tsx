"use client";

import { TagsContext } from "@/app/dashboard/Providers";
import { MonthSpendingRow } from "@/app/dashboard/types";
import { useContext, useState } from "react";
import * as R from "remeda";

export function SpendChecker({ spending }: { spending: MonthSpendingRow[] }) {
  const [tagId, setTagId] = useState<string | null>(null);
  const tags = useContext(TagsContext);
  const spendingByTagId = R.indexBy(spending, (t) => t.tag_id);
  const focusedSpending = spendingByTagId[tagId ?? ""];
  return (
    <div>
      Last month spending by tag
      <div className="flex flex-wrap gap-2">
        <select value={tagId ?? ""} onChange={(e) => setTagId(e.target.value)}>
          {tags?.map((t) => (
            <option key={t.tag} value={t.id}>
              {t.tag}
            </option>
          ))}
          <option value="">None</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <div>{focusedSpending?.amount}</div>
        <div>{focusedSpending?.month}</div>
        <div>{focusedSpending?.tag}</div>
      </div>
    </div>
  );
}
