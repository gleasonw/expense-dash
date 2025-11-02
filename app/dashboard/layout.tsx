import { Providers } from "@/app/dashboard/Providers";
import { db } from "@/server/db";
import { tags_new } from "@/server/schema";
import { getUserWithTokenThrows } from "@/server/session";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserWithTokenThrows();
  if (user === "no-plaid-account") {
    return <div>No plaid account</div>;
  }
  const tags = await db.query.tags_new.findMany({
    where: eq(tags_new.userId, user.user.id),
  });
  return <Providers tags={tags}>{children}</Providers>;
}
