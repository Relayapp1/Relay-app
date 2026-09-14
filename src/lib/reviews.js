import { base44 } from '@/api/base44Client';

export async function submitTripReview(trip, rating, comment) {
  try {
    const response = await base44.functions.invoke('submit-review', { trip_id: trip.id, rating, comment });
    return response?.data ?? response;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error?.message || 'Could not submit review');
  }
}
