// Supabase Edge Function: username/password adapter for Supabase Auth.
// Required function secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// The service-role key must ONLY exist in Edge Function secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { action, username, password, recovery_email } = await req.json();
    const normalized = String(username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) return json({ error: "ชื่อผู้ใช้ต้องมี 3–24 ตัว ใช้ a-z, 0-9 หรือ _ เท่านั้น" }, 400);
    if (typeof password !== "string" || password.length < 8 || password.length > 72) return json({ error: "รหัสผ่านต้องมี 8–72 ตัวอักษร" }, 400);
    if (recovery_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recovery_email)) return json({ error: "รูปแบบอีเมลกู้คืนไม่ถูกต้อง" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const syntheticEmail = `${normalized}@accounts.celestiallupus.com`;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const publicClient = createClient(url, anonKey, { auth: { persistSession: false } });

    if (action === "signup") {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true,
        user_metadata: { username: normalized, recovery_email: recovery_email ?? null },
      });
      if (createError) return json({ error: createError.message }, 400);
      const { data: signed, error: signError } = await publicClient.auth.signInWithPassword({ email: syntheticEmail, password });
      if (signError || !signed.session) {
        if (created.user) await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: "สร้างบัญชีไม่สำเร็จ กรุณาลองใหม่" }, 400);
      }
      return json({ session: signed.session, user: { id: signed.user.id, username: normalized } });
    }

    if (action === "login") {
      const { data, error } = await publicClient.auth.signInWithPassword({ email: syntheticEmail, password });
      if (error || !data.session) return json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
      return json({ session: data.session, user: { id: data.user.id, username: normalized } });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (_err) {
    return json({ error: "คำขอไม่ถูกต้อง กรุณาลองใหม่" }, 400);
  }
});