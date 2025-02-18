import { getCurrentSession } from "@/server/session";
import { redirect } from "next/navigation";
import { LocalPostgresProvider } from "@/app/dashboard/LocalPostgresProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LocalPostgresProvider>{children}</LocalPostgresProvider>;
}
