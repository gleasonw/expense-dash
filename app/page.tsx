import { getCurrentSession } from "@/server/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getCurrentSession();
  if (!session.user) {
    return redirect("/login");
  } else {
    return redirect("/dashboard");
  }
}
