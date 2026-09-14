import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Sign in required" }, { status: 401 });

    const uid = user.id;
    const admin = base44.asServiceRole;

    const dedupe = (arr: any[]) => arr.filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);

    // Delete profile records
    const drivers = await admin.entities.Driver.filter({ created_by_id: uid }, "-created_date", 10);
    await Promise.all(drivers.map((d: any) => admin.entities.Driver.delete(d.id)));
    const brokers = await admin.entities.Broker.filter({ created_by_id: uid }, "-created_date", 10);
    await Promise.all(brokers.map((b: any) => admin.entities.Broker.delete(b.id)));

    // Delete trip route points and incident reports before their parent trips
    const locationsAsDriver = await admin.entities.TripLocation.filter({ driver_id: uid }, "-recorded_at", 5000);
    const locationsAsBroker = await admin.entities.TripLocation.filter({ broker_id: uid }, "-recorded_at", 5000);
    await Promise.all(dedupe([...locationsAsDriver, ...locationsAsBroker]).map((p: any) => admin.entities.TripLocation.delete(p.id)));
    const incidentsAsDriver = await admin.entities.TripIncident.filter({ driver_id: uid }, "-created_date", 1000);
    const incidentsAsBroker = await admin.entities.TripIncident.filter({ broker_id: uid }, "-created_date", 1000);
    await Promise.all(dedupe([...incidentsAsDriver, ...incidentsAsBroker]).map((i: any) => admin.entities.TripIncident.delete(i.id)));

    // Delete trips (as driver or broker)
    const tripsAsDriver = await admin.entities.Trip.filter({ driver_id: uid }, "-created_date", 500);
    const tripsAsBroker = await admin.entities.Trip.filter({ broker_id: uid }, "-created_date", 500);
    await Promise.all(dedupe([...tripsAsDriver, ...tripsAsBroker]).map((t: any) => admin.entities.Trip.delete(t.id)));

    // Delete bids
    const bids = await admin.entities.Bid.filter({ driver_id: uid }, "-created_date", 500);
    await Promise.all(bids.map((b: any) => admin.entities.Bid.delete(b.id)));

    // Delete deals (as broker)
    const deals = await admin.entities.Deal.filter({ broker_id: uid }, "-created_date", 500);
    await Promise.all(deals.map((d: any) => admin.entities.Deal.delete(d.id)));

    // Delete messages
    const msgsDriver = await admin.entities.Message.filter({ driver_id: uid }, "-created_date", 1000);
    const msgsBroker = await admin.entities.Message.filter({ broker_id: uid }, "-created_date", 1000);
    await Promise.all(dedupe([...msgsDriver, ...msgsBroker]).map((m: any) => admin.entities.Message.delete(m.id)));

    // Delete reviews (as reviewer or reviewee)
    const revReviewer = await admin.entities.Review.filter({ reviewer_id: uid }, "-created_date", 500);
    const revReviewee = await admin.entities.Review.filter({ reviewee_id: uid }, "-created_date", 500);
    await Promise.all(dedupe([...revReviewer, ...revReviewee]).map((r: any) => admin.entities.Review.delete(r.id)));

    // Delete trip expenses
    const expDriver = await admin.entities.TripExpense.filter({ driver_id: uid }, "-created_date", 1000);
    const expBroker = await admin.entities.TripExpense.filter({ broker_id: uid }, "-created_date", 1000);
    await Promise.all(dedupe([...expDriver, ...expBroker]).map((e: any) => admin.entities.TripExpense.delete(e.id)));

    // Delete wallet and transactions
    const wallets = await admin.entities.Wallet.filter({ user_id: uid }, "-created_date", 10);
    await Promise.all(wallets.map((w: any) => admin.entities.Wallet.delete(w.id)));
    const walletTxns = await admin.entities.WalletTransaction.filter({ user_id: uid }, "-created_date", 1000);
    await Promise.all(walletTxns.map((t: any) => admin.entities.WalletTransaction.delete(t.id)));

    // Delete email verification records
    const verifications = await admin.entities.EmailVerification.filter({ user_id: uid }, "-created_date", 10);
    await Promise.all(verifications.map((v: any) => admin.entities.EmailVerification.delete(v.id)));

    // Delete the user account itself
    try {
      await admin.entities.User.delete(uid);
    } catch (e) {
      console.error("delete-account: user record delete failed", e);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("delete-account", error);
    return Response.json({ error: error instanceof Error ? error.message : "Account deletion failed" }, { status: 500 });
  }
}