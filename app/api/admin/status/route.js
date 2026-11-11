// Your daily status report, any time, in your own browser (never share this link):
//   https://www.heybellio.com/api/admin/status?key=YOUR_CRON_SECRET
// The same report is texted to ADMIN_PHONE every morning.

import { buildStatus, statusText } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || new URL(request.url).searchParams.get("key") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await buildStatus();
  return Response.json({ text: statusText(status), ...status });
}
