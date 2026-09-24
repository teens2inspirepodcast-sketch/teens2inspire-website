import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MembershipSignup } from "@/components/MembershipSignup";
export const metadata: Metadata = { title: "Join Teens2Inspire" };
export default async function SignupPage() {
  const supabase = await createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/profile");
  }
  return <MembershipSignup />;
}
