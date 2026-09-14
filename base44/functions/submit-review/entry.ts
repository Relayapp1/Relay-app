import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const tripId = String(body.trip_id || "");
    const rating = Number(body.rating);
    const comment = String(body.comment || "").trim();
    if (!tripId) return Response.json({ error: "Trip is required" }, { status: 400 });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return Response.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    const trips = await base44.asServiceRole.entities.Trip.filter({ id: tripId }, "-created_date", 1);
    const trip = trips[0];
    if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });

    const isDriver = trip.driver_id === user.id;
    const isBroker = trip.broker_id === user.id;
    if (!isDriver && !isBroker) return Response.json({ error: "Only trip participants can leave a review" }, { status: 403 });
    if (trip.status !== "completed") return Response.json({ error: "The trip must be completed first" }, { status: 400 });

    const reviewerRole = isDriver ? "driver" : "broker";
    const revieweeRole = isDriver ? "broker" : "driver";
    const revieweeId = isDriver ? trip.broker_id : trip.driver_id;

    const existing = await base44.asServiceRole.entities.Review.filter({ trip_id: tripId, reviewer_id: user.id }, "-created_date", 1);
    if (existing[0]) return Response.json({ error: "You already reviewed this trip" }, { status: 400 });

    await base44.asServiceRole.entities.Review.create({
      deal_id: trip.deal_id,
      trip_id: tripId,
      reviewer_id: user.id,
      reviewer_name: user.full_name || user.email,
      reviewer_role: reviewerRole,
      reviewee_id: revieweeId,
      reviewee_role: revieweeRole,
      rating,
      comment
    });

    const allReviews = await base44.asServiceRole.entities.Review.filter({ reviewee_id: revieweeId }, "-created_date", 500);
    const total = allReviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0);
    const avgRating = Math.round((total / allReviews.length) * 10) / 10;

    const entityName = revieweeRole === "driver" ? "Driver" : "Broker";
    const profiles = await base44.asServiceRole.entities[entityName].filter({ created_by_id: revieweeId }, "-created_date", 1);
    const profile = profiles[0];
    if (profile) {
      await base44.asServiceRole.entities[entityName].update(profile.id, {
        rating: avgRating,
        review_count: allReviews.length
      });
    }

    return Response.json({ success: true, rating: avgRating, review_count: allReviews.length });
  } catch (error) {
    console.error("submit-review", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not submit review" }, { status: 500 });
  }
}
