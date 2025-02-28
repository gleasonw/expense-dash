import { getCurrentSession } from "@/server/session";
import { redirect } from "next/navigation";
import { Providers } from "@/app/dashboard/Providers";
import { db } from "@/server/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tags = await db.query.tags.findMany();
  return <Providers tags={tags}>{children}</Providers>;
}
