import { createClient } from "@supabase/supabase-js";
import { sendNotification } from "web-push-neo";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SUPABASE_SECRET_KEY = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC_KEY = "BC1FvK-ER2a0uXro8S_JuUsAzSBQ0dxrZqEM1kox8s7l1C5J_AY0SYaV5UkhE8SMR-opBgrYey8w0i0dazs9eKQ";
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const webhookSecret = req.headers.get("x-jamaat-push-secret") || "";
  const { data: config, error: configError } = await admin.rpc("get_push_config", { p_secret: webhookSecret });
  if (configError || !config?.[0]?.private_key) return Response.json({ error: "Unauthorized or push configuration missing" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const payload = { title: String(body.title || "JAMAAT APP"), body: String(body.message || "নতুন তথ্য প্রকাশিত হয়েছে"), icon: "https://muyeedsarker.github.io/JAMAAT-APP-2026/icon-192.png", badge: "https://muyeedsarker.github.io/JAMAAT-APP-2026/icon-192.png", data: { url: String(body.url || "./news.html") }, tag: String(body.tag || "jamaat-update") };
  const { data: subscriptions, error } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent=0, failed=0, removed=0;
  for (const row of subscriptions || []) {
    try {
      await sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}}, JSON.stringify(payload), {vapidDetails:{subject:"https://muyeedsarker.github.io/JAMAAT-APP-2026/",publicKey:VAPID_PUBLIC_KEY,privateKey:config[0].private_key},ttl:86400,urgency:"high"});
      sent++;
    } catch (err) {
      failed++;
      const status=Number(err?.statusCode||err?.status||0);
      if(status===404||status===410){await admin.from("push_subscriptions").delete().eq("id",row.id);removed++;}
    }
  }
  return Response.json({ok:true,sent,failed,removed});
});