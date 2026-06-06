const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

export const sb = {
  async query(table: string, method = "GET", body: object | null = null, filter = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filter}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: method === "POST" || method === "PATCH" ? "return=representation" : "",
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) { const e = await res.text(); throw new Error(e); }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },
  get:   (t: string, f = "")                      => sb.query(t, "GET",    null, f),
  post:  (t: string, b: object)                   => sb.query(t, "POST",   b),
  patch: (t: string, b: object, f: string)        => sb.query(t, "PATCH",  b, f),
  del:   (t: string, f: string)                   => sb.query(t, "DELETE", null, f),
};
