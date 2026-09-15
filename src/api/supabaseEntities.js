// Deliberately temporary compatibility shim: exposes the same
// {list, filter, create, update, delete} shape as base44.entities.X so the
// business-logic-dense pages could be cut over with mechanical import swaps
// rather than a line-by-line rewrite. Realtime (.subscribe) is NOT shimmed
// here on purpose — the Supabase payload shape genuinely differs from
// base44's, see src/hooks/useSupabaseSubscription.js.
import { supabase } from '@/api/supabaseClient';

const TABLES = {
  User: 'profiles',
  Bid: 'bids',
  Broker: 'brokers',
  Deal: 'deals',
  Driver: 'drivers',
  FavoriteDriver: 'favorite_drivers',
  Message: 'messages',
  Review: 'reviews',
  SavedRoute: 'saved_routes',
  Trip: 'trips',
  TripExpense: 'trip_expenses',
  TripIncident: 'trip_incidents',
  TripLocation: 'trip_locations',
  Wallet: 'wallets',
  WalletTransaction: 'wallet_transactions',
};

// Every base44 entity had an implicit "created_date" field — our tables call
// the equivalent column "created_at". Translate it wherever a field name
// appears: sort strings and filter-object keys alike.
const field = (name) => (name === 'created_date' ? 'created_at' : name);

// base44 sort strings are field names prefixed with "-" for descending.
function parseSort(sort) {
  if (!sort) return null;
  const descending = sort.startsWith('-');
  return { field: field(descending ? sort.slice(1) : sort), ascending: !descending };
}

// AdminDashboard's cursor pagination passes a Mongo-style operator object
// ({created_date: {$lt: oldest}}) instead of a plain equality value — the
// only such usage in the app, but supported generically here rather than
// special-cased in that one caller.
const OPERATORS = { $lt: 'lt', $lte: 'lte', $gt: 'gt', $gte: 'gte', $ne: 'neq' };

function applyMatch(query, match) {
  for (const [key, value] of Object.entries(match || {})) {
    const col = field(key);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, opValue] of Object.entries(value)) {
        const method = OPERATORS[op];
        if (!method) throw new Error(`Unsupported filter operator: ${op}`);
        query = query[method](col, opValue);
      }
    } else {
      query = query.eq(col, value);
    }
  }
  return query;
}

// Every base44 record carried a "created_date" field; our tables call the
// same column "created_at". Alias it back on every read so the ~13 existing
// ".created_date" reads across the app (sort fallbacks, "posted X ago" text,
// cursor pagination) keep working without touching each call site.
const SELECT_COLS = '*, created_date:created_at';

function makeEntity(table) {
  return {
    async list(sort, limit) {
      let query = supabase.from(table).select(SELECT_COLS);
      const s = parseSort(sort);
      if (s) query = query.order(s.field, { ascending: s.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    async filter(match, sort, limit) {
      let query = applyMatch(supabase.from(table).select(SELECT_COLS), match);
      const s = parseSort(sort);
      if (s) query = query.order(s.field, { ascending: s.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    async create(fields) {
      const { data, error } = await supabase.from(table).insert(fields).select(SELECT_COLS).single();
      if (error) throw error;
      return data;
    },
    async update(id, patch) {
      const { data, error } = await supabase.from(table).update(patch).eq('id', id).select(SELECT_COLS).single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };
}

export const entities = Object.fromEntries(
  Object.entries(TABLES).map(([name, table]) => [name, makeEntity(table)])
);
