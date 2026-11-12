import type { NextRequest } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { localParts } from "@/lib/reminder";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return Response.json({ error: "VAPID not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const admin = createAdminClient();

  const { data: reminders } = await admin
    .from("scheduled_reminders")
    .select("id, user_id, target_id, title, scheduled_local_date, timezone");

  if (!reminders?.length) return Response.json({ sent: 0 });

  let sent = 0;
  const now = new Date();

  for (const r of reminders as any[]) {
    let parts;
    try { parts = localParts(now, r.timezone); } catch { continue; }

    if (parts.date < r.scheduled_local_date) continue;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", r.user_id)
      .eq("active", true);

    if (!subs?.length) continue;

    const { data: rating } = await admin
      .from("ratings")
      .select("id")
      .eq("user_id", r.user_id)
      .eq("media_id", r.target_id)
      .maybeSingle();

    const url = rating?.id ? `/entries/${rating.id}/detailed` : "/entries";

    const payload = JSON.stringify({
      title: "Time for your detailed rating",
      body: `Do your detailed rating for ${r.title}.`,
      url,
      icon: "/icons/notification-icon-192.png",
      badge: "/icons/notification-badge.png",
    });

    for (const sub of subs as any[]) {
      const { error: claimErr } = await admin
        .from("reminder_deliveries")
        .insert({ reminder_id: r.id, subscription_id: sub.id });

      if (claimErr?.code === "23505") continue;

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 21600, urgency: "normal", topic: "detailed-rating" }
        );
        sent++;
      } catch (err: any) {
        const status = err?.statusCode;
        if ([404, 410, 400, 413].includes(status)) {
          await admin.from("push_subscriptions").update({ active: false }).eq("id", sub.id);
        }
        // Release claim on failure so it can be retried (dead subs won't be targeted again once inactive)
        await admin.from("reminder_deliveries")
          .delete().eq("reminder_id", r.id).eq("subscription_id", sub.id);
      }
    }
  }

  return Response.json({ sent });
}
