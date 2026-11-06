import type { NextRequest } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let targetEndpoint: string | undefined;
  try {
    const body = await request.json();
    targetEndpoint = body?.endpoint;
  } catch {
    // no body is ok
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id)
    .eq("active", true);

  if (targetEndpoint) {
    query = query.eq("endpoint", targetEndpoint);
  }

  const { data: subs, error: subError } = await query
    .order("updated_at", { ascending: false })
    .limit(1);

  if (subError || !subs?.length) {
    return Response.json({ error: "No active subscription found for this device" }, { status: 404 });
  }

  const sub = subs[0];

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return Response.json({ error: "Push is not configured on this build." }, { status: 500 });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = JSON.stringify({
    title: "Successful Notification from BigOleRankings",
    body: "If you see this, push notifications are working correctly on this device.",
    url: "/settings",
    icon: "/icons/notification-icon-192.png",
    badge: "/icons/notification-icon-192.png",
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload,
      { TTL: 60, urgency: "high", topic: "test" }
    );

    return Response.json({ success: true });
  } catch (err: any) {
    const status = err?.statusCode;
    if ([404, 410, 400, 413].includes(status)) {
      await admin.from("push_subscriptions").update({ active: false }).eq("id", sub.id);
    }
    return Response.json(
      { error: "Failed to send test notification", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
