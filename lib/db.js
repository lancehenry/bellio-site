// Tiny helper for talking to your Supabase database.
// Runs only on the server; the secret key never reaches the browser.

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in Vercel.");
  }
  return { url: url.replace(/\/$/, ""), key };
}

function headers(key, extra = {}) {
  const h = { apikey: key, "Content-Type": "application/json", ...extra };
  // Older Supabase "service_role" keys are JWTs (start with eyJ) and also go in Authorization.
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
}

async function request(path, { method = "GET", body, prefer } = {}) {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: headers(key, prefer ? { Prefer: prefer } : {}),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`Supabase ${method} ${path} failed: ${res.status} ${text}`);
    err.status = res.status;
    err.code = data && data.code;
    throw err;
  }
  return data;
}

// Insert one or more rows and return them.
export async function insert(table, rows) {
  return request(table, { method: "POST", body: rows, prefer: "return=representation" });
}

// Find rows, e.g. select("parents", { inbox_key: "ab12cd34" })
export async function select(table, filters = {}, columns = "*") {
  const params = new URLSearchParams({ select: columns });
  for (const [k, v] of Object.entries(filters)) params.append(k, `eq.${v}`);
  return request(`${table}?${params}`);
}

// Find rows with a raw Supabase query string, e.g.
// query("events", "parent_id=eq.123&event_date=in.(2026-11-09,2026-11-10)&select=event_date,title")
export async function query(table, queryString) {
  return request(`${table}?${queryString}`);
}

// Run a database function, e.g. rpc("bellio_purge").
export async function rpc(name, args = {}) {
  return request(`rpc/${name}`, { method: "POST", body: args });
}

// Update rows with a raw Supabase query string, e.g.
// updateWhere("invites", "id=eq.123&used_at=is.null", { used_at: now })
// Returns only the rows that actually changed, which makes "claim once" checks safe.
export async function updateWhere(table, queryString, values) {
  return request(`${table}?${queryString}`, {
    method: "PATCH",
    body: values,
    prefer: "return=representation",
  });
}

// Update rows matching filters.
export async function update(table, filters, values) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) params.append(k, `eq.${v}`);
  return request(`${table}?${params}`, {
    method: "PATCH",
    body: values,
    prefer: "return=representation",
  });
}
