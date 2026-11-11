// A parent enters their phone number on /family to get a sign-in link by text.
// The reply is always the same, whether or not the number is signed up, so
// nobody can use this form to find out who uses Bellio.

import { sendSms } from "@/lib/sms";
import { createLoginLink, LOGIN_LINK_MINUTES, sameOrigin } from "@/lib/session";
import { findMemberByPhone, normalizePhone } from "@/lib/households";
import { LIMITS, clientIp, isHoneypotFilled, overLimit, passedTurnstile } from "@/lib/protect";

const SAME_ANSWER = {
  ok: true,
  message: "If that number belongs to a Bellio family, we just texted it a sign-in link.",
};

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (isHoneypotFilled(body)) return Response.json(SAME_ANSWER);
  const ip = clientIp(request);
  if (await overLimit(LIMITS.loginLinkPerIp, ip)) {
    return Response.json({ error: "Too many requests. Please try again in an hour." }, { status: 429 });
  }
  if (!(await passedTurnstile(body.turnstileToken, ip))) {
    return Response.json(
      { error: "We couldn't confirm you're not a robot. Please refresh the page and try again." },
      { status: 400 }
    );
  }

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return Response.json({ error: "Please enter a valid US mobile number." }, { status: 400 });
  }

  try {
    const member = await findMemberByPhone(phone);
    // Only text real members who haven't opted out, and not too often.
    if (member && !member.sms_opted_out && !(await overLimit(LIMITS.loginLinkPerPhone, phone))) {
      const link = await createLoginLink(member);
      await sendSms(
        member,
        `Bellio: Here's your link to manage your family. It works once and expires in ${LOGIN_LINK_MINUTES} minutes: ${link}`
      );
    }
  } catch (err) {
    console.error(`Login link request failed: ${err.message}`);
  }
  return Response.json(SAME_ANSWER);
}
