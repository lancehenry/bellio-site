import Link from "next/link";
import { select } from "@/lib/db";
import { INVITE_PROBLEMS, MAX_MEMBERS, checkInvite, getKids, getMembers } from "@/lib/households";
import site from "@/site.config";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";
export const metadata = { title: `Join a family — ${site.name}`, robots: { index: false } };

async function loadInvite(code) {
  try {
    const { invite, household, problem } = await checkInvite(code);
    if (problem) return { problem };
    const [members, kids] = await Promise.all([getMembers(household.id), getKids(household.id)]);
    if (members.length >= MAX_MEMBERS) return { problem: "full" };
    const [inviter] = invite.created_by ? await select("members", { id: invite.created_by }) : [];
    const owner = inviter || members.find((m) => m.role === "owner") || members[0];
    return { inviter: owner?.first_name, kids: kids.map((k) => k.first_name) };
  } catch (err) {
    console.error("Loading invite failed:", err);
    return { problem: "invalid" };
  }
}

export default async function JoinPage({ params }) {
  const { code } = await params;
  const invite = await loadInvite(code);

  if (invite.problem) {
    const message =
      invite.problem === "full"
        ? `This family already has ${MAX_MEMBERS} adults, the most a Bellio family can have.`
        : INVITE_PROBLEMS[invite.problem];
    return (
      <section className="container join">
        <h1>This invite can&rsquo;t be used</h1>
        <p className="lede">{message}</p>
        <p className="lede">
          Want reminders of your own? <Link href="/#signup">Start your own family</Link>.
        </p>
      </section>
    );
  }

  const kidList = invite.kids.join(" & ");
  return (
    <section className="container join">
      <div className="join-inner">
        <div>
          <p className="eyebrow">You&rsquo;re invited</p>
          <h1>Join {invite.inviter ? `${invite.inviter}'s` : "your"} family on {site.name}</h1>
          <p className="lede">
            Get the same night-before school reminders
            {kidList ? ` for ${kidList}` : ""} on your own phone. You&rsquo;ll
            both see everything, and either of you can forward school emails.
          </p>
          <p className="hint">
            Bellio families are for parents and legal guardians, up to {MAX_MEMBERS} adults.
          </p>
        </div>
        <JoinForm code={code} />
      </div>
    </section>
  );
}
