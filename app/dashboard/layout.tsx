import { getCurrentSession } from "@/server/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session.user) {
    return redirect("/");
  }
  return <div>{children}</div>;
}
