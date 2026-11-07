// Receives the signup form.
//
// For now this validates the submission and writes it to your Vercel logs
// (Vercel dashboard → your project → Logs). That's enough to show carriers a
// working opt-in flow. Before real parents sign up, connect Supabase here so
// signups (and the consent timestamp) are saved permanently.

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const firstName = String(body.firstName || "").trim();
  const email = String(body.email || "").trim();
  const phoneDigits = String(body.phone || "").replace(/\D/g, "");

  if (!firstName) {
    return Response.json({ error: "Please enter your first name." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (!(phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith("1")))) {
    return Response.json({ error: "Please enter a valid US mobile number." }, { status: 400 });
  }
  if (body.smsConsent !== true) {
    return Response.json(
      { error: "Please check the box to agree to receive text reminders." },
      { status: 400 }
    );
  }

  const signup = {
    firstName,
    email,
    phone: "+1" + phoneDigits.slice(-10),
    smsConsent: true,
    consentAt: new Date().toISOString(),
    // Keep a record of how consent was collected; carriers can ask for it.
    consentSource: "heybellio.com signup form",
  };

  console.log("New signup:", JSON.stringify(signup));

  return Response.json({ ok: true });
}
