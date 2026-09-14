import { base44 } from '@/api/base44Client';

async function call(payload) {
  try {
    const response = await base44.functions.invoke('trip-review', payload);
    return response?.data ?? response;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error?.message || 'Trip review failed');
  }
}

export const approveTripDelivery = (trip) =>
  call({ action: 'approve', trip_id: trip.id });

export const disputeTripDelivery = (trip, reason) =>
  call({ action: 'dispute', trip_id: trip.id, reason });

export const resolveTripDispute = (trip, resolution) =>
  call({ action: 'resolve', trip_id: trip.id, resolution });
