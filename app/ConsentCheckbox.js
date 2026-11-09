import Link from "next/link";
import site from "@/site.config";

// The text-message consent checkbox. Carriers check this wording, so it's kept
// identical on the signup and co-parent join forms.
export default function ConsentCheckbox() {
  return (
    <label className="consent">
      <input name="smsConsent" type="checkbox" required />
      <span>
        I agree to receive recurring text reminders from {site.name} at the
        number provided. Message frequency varies. Msg &amp; data rates may
        apply. Reply STOP to cancel, HELP for help. Consent is not a condition
        of purchase. See our <Link href="/terms">SMS Terms</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </span>
    </label>
  );
}
