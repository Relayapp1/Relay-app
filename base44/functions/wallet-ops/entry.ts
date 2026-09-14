import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

const INSTANT_PAYOUT_FEE = 2;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const action = body.action;
    const role = user.account_type === "driver" ? "driver" : "broker";
    const admin = user.role === "admin";

    const getWallet = async (uid: string, wrole: string) => {
      const existing = await base44.asServiceRole.entities.Wallet.filter({ user_id: uid }, "-created_date", 1);
      if (existing[0]) return existing[0];
      return await base44.asServiceRole.entities.Wallet.create({ user_id: uid, role: wrole, balance: 0, pending_deposits: 0, pending_withdrawals: 0 });
    };

    if (action === "deposit_request") {
      if (role !== "broker" && !admin) return Response.json({ error: "Only brokers can add funds" }, { status: 403 });
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return Response.json({ error: "Enter a valid amount" }, { status: 400 });
      const wallet = await getWallet(user.id, "broker");
      await base44.asServiceRole.entities.Wallet.update(wallet.id, { pending_deposits: Number(wallet.pending_deposits || 0) + amount });
      await base44.asServiceRole.entities.WalletTransaction.create({ user_id: user.id, role: "broker", type: "deposit", amount, status: "pending", notes: body.notes || "" });
      return Response.json({ success: true });
    }

    if (action === "withdraw_request") {
      if (role !== "driver" && !admin) return Response.json({ error: "Only drivers can withdraw" }, { status: 403 });
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return Response.json({ error: "Enter a valid amount" }, { status: 400 });
      const speed = body.speed === "instant" ? "instant" : "standard";
      const feeAmount = speed === "instant" ? INSTANT_PAYOUT_FEE : 0;
      const total = amount + feeAmount;
      const wallet = await getWallet(user.id, "driver");
      if (Number(wallet.balance || 0) < total) return Response.json({ error: `Insufficient balance for withdrawal${feeAmount ? ` (includes $${feeAmount.toFixed(2)} instant payout fee)` : ""}` }, { status: 400 });
      await base44.asServiceRole.entities.Wallet.update(wallet.id, { pending_withdrawals: Number(wallet.pending_withdrawals || 0) + total });
      await base44.asServiceRole.entities.WalletTransaction.create({ user_id: user.id, role: "driver", type: "withdrawal", amount, speed, fee_amount: feeAmount, status: "pending", bank_name: body.bank_name || "", bank_account_last4: body.bank_account_last4 || "", bank_routing: body.bank_routing || "" });
      return Response.json({ success: true });
    }

    if (action === "reserve_funding") {
      const tripId = body.trip_id;
      const amount = Number(body.amount);
      if (!tripId || !amount || amount <= 0) return Response.json({ error: "Invalid funding amount" }, { status: 400 });
      const trips = await base44.asServiceRole.entities.Trip.filter({ id: tripId }, "-created_date", 1);
      const trip = trips[0];
      if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
      if (trip.broker_id !== user.id && !admin) return Response.json({ error: "Only the assigned broker can confirm funding" }, { status: 403 });
      if (trip.funding_status === "confirmed") return Response.json({ error: "Funding is already confirmed" }, { status: 400 });
      if (!["scheduled","paused"].includes(trip.status)) return Response.json({ error: "Funding must be confirmed before departure" }, { status: 400 });
      const brokerWallet = await getWallet(trip.broker_id, "broker");
      if (Number(brokerWallet.balance || 0) < amount) return Response.json({ error: `Insufficient wallet balance ($${Number(brokerWallet.balance || 0).toFixed(2)}). Add funds first.` }, { status: 400 });
      await base44.asServiceRole.entities.Wallet.update(brokerWallet.id, { balance: Number(brokerWallet.balance || 0) - amount });
      await base44.asServiceRole.entities.WalletTransaction.create({ user_id: trip.broker_id, role: "broker", type: "funding_reserved", amount, status: "completed", trip_id: tripId, counterparty_id: trip.driver_id });
      await base44.asServiceRole.entities.Trip.update(tripId, { funding_status: "confirmed", funded_amount: amount, funded_at: new Date().toISOString(), payment_method: "Relay wallet" });
      return Response.json({ success: true, amount });
    }

    if (action === "refund_funding") {
      const tripId = body.trip_id;
      const trips = await base44.asServiceRole.entities.Trip.filter({ id: tripId }, "-created_date", 1);
      const trip = trips[0];
      if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
      if (![trip.broker_id, trip.driver_id].includes(user.id) && !admin) return Response.json({ error: "Not authorized for this trip" }, { status: 403 });
      if (trip.funding_status !== "confirmed") return Response.json({ success: true, refunded: 0 });
      const amount = Number(trip.funded_amount || 0);
      const brokerWallet = await getWallet(trip.broker_id, "broker");
      await base44.asServiceRole.entities.Wallet.update(brokerWallet.id, { balance: Number(brokerWallet.balance || 0) + amount });
      await base44.asServiceRole.entities.WalletTransaction.create({ user_id: trip.broker_id, role: "broker", type: "funding_refund", amount, status: "completed", trip_id: tripId, counterparty_id: trip.driver_id });
      await base44.asServiceRole.entities.Trip.update(tripId, { funding_status: "refunded" });
      return Response.json({ success: true, refunded: amount });
    }

    if (action === "charge_cancellation_fee") {
      const tripId = body.trip_id;
      const trips = await base44.asServiceRole.entities.Trip.filter({ id: tripId }, "-created_date", 1);
      const trip = trips[0];
      if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
      if (trip.driver_id !== user.id && !admin) return Response.json({ error: "Not authorized for this trip" }, { status: 403 });
      if (trip.status !== "cancelled" || trip.cancelled_by !== "driver") return Response.json({ error: "This cancellation is not fee-eligible" }, { status: 400 });
      if (trip.cancellation_fee_status !== "policy_pending") return Response.json({ success: true, amount: Number(trip.cancellation_fee_amount || 0) });
      const fee = Math.round(Number(trip.accepted_rate || 0) * Number(trip.estimated_hours || 0) * 0.10 * 100) / 100;
      if (fee > 0) {
        const driverWallet = await getWallet(trip.driver_id, "driver");
        await base44.asServiceRole.entities.Wallet.update(driverWallet.id, { balance: Number(driverWallet.balance || 0) - fee });
        await base44.asServiceRole.entities.WalletTransaction.create({ user_id: trip.driver_id, role: "driver", type: "cancellation_fee", amount: fee, status: "completed", trip_id: tripId, counterparty_id: trip.broker_id, notes: "10% of estimated job value, deducted from wallet (may go negative, recovered from future payouts)" });
      }
      await base44.asServiceRole.entities.Trip.update(tripId, { cancellation_fee_status: "assessed", cancellation_fee_amount: fee });
      return Response.json({ success: true, amount: fee });
    }

    if (action === "process_payment") {
      const tripId = body.trip_id;
      const total = Number(body.amount);
      if (!tripId || !total || total <= 0) return Response.json({ error: "Invalid payment" }, { status: 400 });
      const trips = await base44.asServiceRole.entities.Trip.filter({ id: tripId }, "-created_date", 1);
      const trip = trips[0];
      if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
      if (trip.broker_id !== user.id && !admin) return Response.json({ error: "Only the broker can pay for this trip" }, { status: 403 });
      if (trip.payment_status === "sent" || trip.payment_status === "received") return Response.json({ error: "Payment already sent for this trip" }, { status: 400 });
      if (!["approved","resolved"].includes(trip.delivery_review_status)) return Response.json({ error: trip.delivery_review_status === "disputed" ? "Payment is paused while the delivery dispute is open" : "The broker must approve the delivery before payment" }, { status: 400 });
      const brokerWallet = await getWallet(trip.broker_id, "broker");
      const reserved = trip.funding_status === "confirmed" ? Number(trip.funded_amount || 0) : 0;
      const additional = Math.max(0, total - reserved);
      if (Number(brokerWallet.balance || 0) < additional) return Response.json({ error: `Insufficient wallet balance for the remaining $ ${additional.toFixed(2)}.` }, { status: 400 });
      const refund = Math.max(0, reserved - total);
      const driverWallet = await getWallet(trip.driver_id, "driver");
      await base44.asServiceRole.entities.Wallet.update(brokerWallet.id, { balance: Number(brokerWallet.balance || 0) - additional + refund });
      await base44.asServiceRole.entities.Wallet.update(driverWallet.id, { balance: Number(driverWallet.balance || 0) + total });
      await base44.asServiceRole.entities.WalletTransaction.create({ user_id: trip.broker_id, role: "broker", type: "payment_sent", amount: total, status: "completed", trip_id: tripId, counterparty_id: trip.driver_id });
      await base44.asServiceRole.entities.WalletTransaction.create({ user_id: trip.driver_id, role: "driver", type: "payment_received", amount: total, status: "completed", trip_id: tripId, counterparty_id: trip.broker_id });
      if (refund > 0) await base44.asServiceRole.entities.WalletTransaction.create({ user_id: trip.broker_id, role: "broker", type: "funding_refund", amount: refund, status: "completed", trip_id: tripId, counterparty_id: trip.driver_id });
      await base44.asServiceRole.entities.Trip.update(tripId, { payment_status: "sent", funding_status: reserved > 0 ? "released" : trip.funding_status });
      return Response.json({ success: true });
    }

    if (action === "approve" || action === "reject") {
      if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });
      const txnId = body.transaction_id;
      const txns = await base44.asServiceRole.entities.WalletTransaction.filter({ id: txnId }, "-created_date", 1);
      const txn = txns[0];
      if (!txn) return Response.json({ error: "Transaction not found" }, { status: 404 });
      if (txn.status !== "pending") return Response.json({ error: "Transaction already processed" }, { status: 400 });
      const wallet = await getWallet(txn.user_id, txn.role);
      const withdrawalTotal = Number(txn.amount) + Number(txn.fee_amount || 0);
      if (action === "approve") {
        if (txn.type === "deposit") await base44.asServiceRole.entities.Wallet.update(wallet.id, { balance: Number(wallet.balance || 0) + Number(txn.amount), pending_deposits: Math.max(0, Number(wallet.pending_deposits || 0) - Number(txn.amount)) });
        if (txn.type === "withdrawal") {
          if (Number(wallet.balance || 0) < withdrawalTotal) return Response.json({ error: "Driver has insufficient balance" }, { status: 400 });
          await base44.asServiceRole.entities.Wallet.update(wallet.id, { balance: Number(wallet.balance || 0) - withdrawalTotal, pending_withdrawals: Math.max(0, Number(wallet.pending_withdrawals || 0) - withdrawalTotal) });
        }
        await base44.asServiceRole.entities.WalletTransaction.update(txnId, { status: "completed" });
      } else {
        if (txn.type === "deposit") await base44.asServiceRole.entities.Wallet.update(wallet.id, { pending_deposits: Math.max(0, Number(wallet.pending_deposits || 0) - Number(txn.amount)) });
        if (txn.type === "withdrawal") await base44.asServiceRole.entities.Wallet.update(wallet.id, { pending_withdrawals: Math.max(0, Number(wallet.pending_withdrawals || 0) - withdrawalTotal) });
        await base44.asServiceRole.entities.WalletTransaction.update(txnId, { status: "rejected" });
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("wallet-ops", error);
    return Response.json({ error: error instanceof Error ? error.message : "Wallet operation failed" }, { status: 500 });
  }
}