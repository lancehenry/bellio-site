// For you (the owner) only: makes a Manage Family sign-in link for any member,
// so you can test the page before texting is live, or help a parent.
//
//   https://www.heybellio.com/api/admin/login-link?key=YOUR_CRON_SECRET&phone=9135550101
//
// Open it in your own browser only. The link it returns works once, for 15 minutes.

import { createLoginLink } from "@/lib/session";
import { findMemberByPhone, normalizePhone } from "@/lib/households";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("key") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const phone = normalizePhone(url.searchParams.get("phone"));
  if (!phone) return Response.json({ error: "Add &phone=9135551234" }, { status: 400 });

  const member = await findMemberByPhone(phone);
  if (!member) return Response.json({ error: "No member with that phone number." }, { status: 404 });

  const link = await createLoginLink(member);
  console.log(`Admin created a sign-in link for member ${member.id}`);
  return Response.json({ member: member.first_name, link, expiresInMinutes: 15 });
}
