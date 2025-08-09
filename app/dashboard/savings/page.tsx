import { getSpendingByMonth } from "@/app/dashboard/aggregates";
import { getBuckets } from "@/app/dashboard/buckets_sdk";
import { BucketForm } from "@/app/dashboard/savings/BucketForm";
import { ExistingBucket } from "@/app/dashboard/savings/ExistingBucket";
import { getUserWithToken } from "@/server/session";

export default async function Savings() {
  const user = await getUserWithToken();
  if (user === "no-plaid-account") {
    return (
      <div className="p-3">
        <p>You need to connect your bank account to use this feature.</p>
      </div>
    );
  }
  const { rows } = await getSpendingByMonth({ afterXMonthsAgo: 1 });
  const buckets = await getBuckets();

  //TODO: hardcoded savings tag? should probably just be a default we add
  // when the user registers
  const currentMonthSavings = rows.find(
    (row) => row.is_current_month && row.tag === "savings"
  );
  const priorMonthSavings = rows.find(
    (row) => !row.is_current_month && row.tag === "savings"
  );
  return (
    <div className="p-3 flex flex-col gap-5">
      <BucketForm />
      <div className="flex flex-wrap gap-5 shadow-md p-5">
        <h1>Savings overview</h1>
        <div>
          <h2>Current Month</h2>
          {currentMonthSavings?.amount}
        </div>
        <div>
          <h2>Prior Month</h2>
          {priorMonthSavings?.amount}
          TODO: just show target savings here, get allocation percent, multiply
          by expected income
        </div>
        <div>
          TODO: warning 1: total movements exceed current actual savings
          transactions
        </div>
        <div>TODO: warning 2: active percentage buckets exceed 100%</div>
      </div>
      <div className="flex flex-wrap gap-5">
        {buckets.map((bucket) => (
          <ExistingBucket key={bucket.id} bucket={bucket} />
        ))}
      </div>
    </div>
  );
}
