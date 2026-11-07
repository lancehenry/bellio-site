import site from "@/site.config";
import SignupForm from "./SignupForm";

const steps = [
  {
    n: "1",
    title: "Forward your school emails",
    body: "Send district emails, teacher newsletters, and PTA messages to your personal Bellio address. Or set up a one-time auto-forward and forget about it.",
  },
  {
    n: "2",
    title: "Bellio finds what matters",
    body: "We pull out the dates and to-dos buried in long emails and flyers: early release, picture day, spirit week, money or forms to send.",
  },
  {
    n: "3",
    title: "Get a text the night before",
    body: "One short text, only when there's something to know or do tomorrow. No app to open, no inbox to dig through.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">For busy school parents</p>
            <h1>
              School emails, turned into texts you&rsquo;ll actually read.
            </h1>
            <p className="lede">
              {site.name} reads the school emails and flyers you forward, finds
              the dates and to-dos, and texts you the night before. Never miss
              picture day again.
            </p>
            <a href="#signup" className="btn">
              Join the free beta
            </a>
          </div>

          <div className="phone" aria-label="Example Bellio text message">
            <div className="phone-top">{site.name}</div>
            <div className="bubble">
              Tomorrow (Thu 11/12): Picture day for Emma. Wear a collared
              shirt.
            </div>
            <div className="bubble">
              Also: $5 for the field trip is due Friday. Reply STOP to opt out.
            </div>
          </div>
        </div>
      </section>

      <section className="how">
        <div className="container">
          <h2>How it works</h2>
          <ol className="steps">
            {steps.map((s) => (
              <li key={s.n} className="step">
                <span className="step-num">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="signup" className="signup">
        <div className="container signup-inner">
          <div>
            <h2>Get early access</h2>
            <p>
              We&rsquo;re starting with a small group of parents. Sign up and
              we&rsquo;ll send your personal forwarding address and setup
              steps.
            </p>
          </div>
          <SignupForm />
        </div>
      </section>
    </>
  );
}
