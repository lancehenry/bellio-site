import site from "@/site.config";
import SetupGuide from "./SetupGuide";

export const metadata = {
  title: `Set up auto-forwarding — ${site.name}`,
  description: "Send your school emails to Bellio automatically, in about 2 minutes.",
};

export default function SetupPage() {
  return (
    <section className="container setup">
      <p className="eyebrow">2-minute setup</p>
      <h1>Send school emails to {site.name} automatically</h1>
      <p className="lede">
        Set up a rule in your email once, and every school email goes to
        {" "}{site.name} on its own. Only school emails are forwarded. The rest
        of your inbox stays private.
      </p>
      <p className="lede setup-reassure">
        Your school emails stay in your inbox. {site.name} gets a copy.
      </p>
      <SetupGuide />
    </section>
  );
}
