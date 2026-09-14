import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const action = String(body.action || "");
    const tripId = String(body.trip_id || "");
    if (!tripId) return Response.json({ error: "Trip is required" }, { status: 400 });

    const trips = await base44.asServiceRole.entities.Trip.filter({ id: tripId }, "-created_date", 1);
    const trip = trips[0];
    if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });

    const isAdmin = user.role === "admin";
    const isBroker = trip.broker_id === user.id;
    const now = new Date().toISOString();

    if (action === "approve") {
      if (!isBroker && !isAdmin) return Response.json({ error: "Only the assigned broker can approve this delivery" }, { status: 403 });
      if (trip.status !== "completed") return Response.json({ error: "The driver must complete the trip first" }, { status: 400 });
      if (trip.delivery_review_status === "resolved") return Response.json({ error: "This dispute was already resolved by an administrator" }, { status: 400 });
      await base44.asServiceRole.entities.Trip.update(tripId, {
        delivery_review_status: "approved",
        broker_reviewed_at: now,
        dispute_reason: null,
        dispute_opened_at: null
      });
      return Response.json({ success: true });
    }

    if (action === "dispute") {
      if (!isBroker && !isAdmin) return Response.json({ error: "Only the assigned broker can dispute this delivery" }, { status: 403 });
      if (trip.status !== "completed") return Response.json({ error: "The driver must complete the trip first" }, { status: 400 });
      if (trip.payment_status === "sent" || trip.payment_status === "received") return Response.json({ error: "Payment has already been released" }, { status: 400 });
      const reason = String(body.reason || "").trim();
      if (!reason) return Response.json({ error: "A dispute reason is required" }, { status: 400 });
      await base44.asServiceRole.entities.Trip.update(tripId, {
        delivery_review_status: "disputed",
        dispute_reason: reason,
        dispute_opened_at: now,
        broker_reviewed_at: now
      });
      return Response.json({ success: true });
    }

    if (action === "resolve") {
      if (!isAdmin) return Response.json({ error: "Administrator access required" }, { status: 403 });
      if (trip.delivery_review_status !== "disputed") return Response.json({ error: "This trip does not have an open dispute" }, { status: 400 });
      const resolution = String(body.resolution || "").trim();
      if (!resolution) return Response.json({ error: "Resolution notes are required" }, { status: 400 });
      await base44.asServiceRole.entities.Trip.update(tripId, {
        delivery_review_status: "resolved",
        dispute_resolution: resolution,
        dispute_resolved_at: now,
        broker_reviewed_at: now
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown review action" }, { status: 400 });
  } catch (error) {
    console.error("trip-review", error);
    return Response.json({ error: error instanceof Error ? error.message : "Trip review failed" }, { status: 500 });
  }
}
