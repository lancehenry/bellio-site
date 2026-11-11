// Signs a parent in after they tap "Continue" on the link they were texted.
// (The link page waits for that tap on purpose: phones preview links
// automatically, and a preview must not use up the one-time link.)

import { consumeLoginToken, sameOrigin, sessionCookie } from "@/lib/session";

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const member = await consumeLoginToken(String(body.token || ""));
    if (!member) {
      return Response.json(
        { error: "This link has expired or was already used. Text SETTINGS to Bellio for a new one." },
        { status: 401 }
      );
    }
    console.log(`Member ${member.id} signed in to Manage Family`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie(member.id) },
    });
  } catch (err) {
    console.error(`Sign-in failed: ${err.message}`);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
