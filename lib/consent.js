// Consent history: every opt-in and opt-out, kept 4 years even if the person
// or family is later deleted. Proof of consent if a texting complaint comes up.

import { insert } from "@/lib/db";

// event: "opt_in" | "opt_out"   source: "web_signup" | "invite_link" | "sms_reply"
export async function recordConsent(phone, event, source, householdId = null) {
  try {
    await insert("consent_events", { phone, event, source, household_id: householdId });
  } catch (err) {
    // Never block the signup or the STOP itself; the member record still has the consent fields.
    console.error(`Recording consent (${event}) failed: ${err.message}`);
  }
}
