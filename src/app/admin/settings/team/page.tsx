import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { formatUkDate } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddTeamMemberForm, MemberControls } from "./team-forms";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <Suspense fallback={<p>Loading the team…</p>}>
      <Team />
    </Suspense>
  );
}

async function Team() {
  const access = await requireStaff("/admin/settings/team", "team.manage");
  if (!access.allowed) return <NotAllowed access={access} />;
  const supabase = await createSupabaseServerClient();
  const { data: staff } = await supabase
    .from("staff")
    .select("user_id, role, created_at")
    .order("created_at");
  const ids = (staff ?? []).map((member) => member.user_id);
  const { data: profiles } = ids.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids)
    : { data: [] };
  const byId = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p>
          <Link href="/admin/settings">Back to settings</Link>
        </p>
        <h1 className="mt-2 text-5xl">Team</h1>
        <p className="mt-1 text-lg">Who can sign in to the admin area.</p>
      </div>

      <Card>
        <h2 className="text-3xl">What each role can do</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Owner:</strong> everything, including settings and the team.
          </li>
          <li>
            <strong>Admin:</strong> events, bookings, payments, emails and
            reports. Not settings or the team.
          </li>
          <li>
            <strong>Door staff:</strong> see who&apos;s booked and check people
            in. No money, and can&apos;t change anything else.
          </li>
        </ul>
      </Card>

      <section aria-labelledby="members-heading" className="space-y-3">
        <h2 id="members-heading" className="text-3xl">
          On the team ({staff?.length ?? 0})
        </h2>
        <ul className="space-y-3">
          {(staff ?? []).map((member) => {
            const profile = byId.get(member.user_id);
            const email = profile?.email ?? "Unknown account";
            return (
              <li key={member.user_id}>
                <Card className="space-y-2">
                  <p className="break-words">
                    <strong>{profile?.full_name || email}</strong>
                    {profile?.full_name ? ` (${email})` : null}
                    {member.user_id === access.user.id ? " (you)" : null}
                  </p>
                  <p className="text-sm text-stone">
                    On the team since {formatUkDate(member.created_at)}
                  </p>
                  <MemberControls
                    userId={member.user_id}
                    email={email}
                    role={member.role}
                    isYou={member.user_id === access.user.id}
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <Card className="space-y-3">
        <h2 className="text-3xl">Add someone</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            In Supabase, go to{" "}
            <strong>Authentication → Users → Add user → Create new user</strong>
            . Enter their email address and a temporary password (at least 8
            characters), tick <strong>Auto Confirm User</strong>, then{" "}
            <strong>Create user</strong>.
          </li>
          <li>Add them here, with what they can do.</li>
          <li>
            Tell them their temporary password in person or by phone. They sign
            in at Team sign in, then change it under Change password.
          </li>
        </ol>
        <AddTeamMemberForm />
      </Card>
    </div>
  );
}
