// One place for the details that appear across the site and legal pages.
// Update these before you deploy.
const site = {
  name: "Bellio",
  domain: "heybellio.com",
  url: "https://heybellio.com",
  contactEmail: "hello@heybellio.com",
  // Your legal business name. A sole proprietorship can just be your own name,
  // e.g. "Jane Smith d/b/a Bellio".
  legalName: "Lance Schmittling",
  // State whose laws govern the terms.
  governingState: "Kansas",
  // Fill in once Twilio gives you the number.
  smsNumber: "(866) 456-3681",
  lastUpdated: "November 11, 2026",

  // Pricing. Change these and redeploy; the pricing page, footer link, and FAQ follow.
  pricing: {
    // false hides the pricing page (heybellio.com/pricing shows "not found") and its footer link.
    show: false,
    // true shows "Free during the beta" on the pricing page and in the FAQ, and the
    // button says "Join the free beta". Set to false when you start charging.
    beta: true,
    monthly: 7, // dollars per family per month
    yearly: 60, // dollars per family per year
    trialDays: 30,
    // Refund policy (shown in the Terms and on the pricing page):
    refundDays: 14, // full refund on a yearly plan if asked within this many days of the charge
    renewalReminderDays: 7, // we text this many days before a yearly plan renews
  },
};

export default site;
