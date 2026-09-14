import React, { useEffect, useState } from 'react';
import '@/drivebid.css';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Package, Gavel, TrendingUp, ArrowRight, UserCircle, Briefcase } from 'lucide-react';
import DealCard from '@/components/DealCard';
import StatCard from '@/components/StatCard';

export default function Home() {
  const [user, setUser] = useState(null);
  const [deals, setDeals] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const openDeals = await base44.entities.Deal.filter({ status: 'open' }, '-created_date', 5);
        setDeals(openDeals);
        if (u.account_type === 'driver') {
          const myBids = await base44.entities.Bid.filter({ driver_id: u.id }, '-created_date', 5);
          setBids(myBids);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const chooseRole = async (type) => {
    await base44.auth.updateMe({ account_type: type });
    setUser({ ...user, account_type: type });
  };

  if (loading) return <div className="p-10 text-stone-400">Loading…</div>;

  if (!user?.account_type) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Welcome to Relay</h1>
        <p className="text-stone-500 mb-8">The marketplace where brokers post transport deals and vetted drivers bid for the work. Tell us how you'll use Relay.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => chooseRole('broker')} className="text-left p-6 rounded-2xl border border-stone-200 hover:border-amber-400 hover:shadow-lg transition-all bg-white min-h-11">
            <Briefcase className="w-8 h-8 text-amber-500 mb-3" />
            <h3 className="font-semibold text-lg mb-1">I'm a Broker</h3>
            <p className="text-sm text-stone-500">Post transport deals and review bids from vetted drivers.</p>
          </button>
          <button onClick={() => chooseRole('driver')} className="text-left p-6 rounded-2xl border border-stone-200 hover:border-amber-400 hover:shadow-lg transition-all bg-white min-h-11">
            <UserCircle className="w-8 h-8 text-amber-500 mb-3" />
            <h3 className="font-semibold text-lg mb-1">I'm a Driver</h3>
            <p className="text-sm text-stone-500">Get alerted to job opportunities and bid your hourly rate.</p>
          </button>
        </div>
      </div>
    );
  }

  const isBroker = user.account_type === 'broker';

  return (
    <div className="p-4 md:p-6 w-full max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{isBroker ? 'Broker Dashboard' : 'Driver Dashboard'}</h1>
          <p className="text-stone-500 text-sm mt-1">{isBroker ? 'Manage your posted deals and review driver bids.' : 'Browse open transport deals and place your bids.'}</p>
        </div>
        {isBroker && (
          <Link to="/post-deal" className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors self-start min-h-11">
            <Gavel className="w-4 h-4" /> Post a Deal
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Package} label="Open Deals" value={deals.length} />
        {isBroker ? (
          <StatCard icon={TrendingUp} label="Your Role" value="Broker" />
        ) : (
          <StatCard icon={Gavel} label="Active Bids" value={bids.length} />
        )}
        <StatCard icon={UserCircle} label="Account" value={user.full_name || user.email} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Latest Open Deals</h2>
        <Link to="/deals" className="text-sm text-amber-600 hover:text-amber-700 inline-flex items-center gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></Link>
      </div>
      {deals.length === 0 ? (
        <div className="text-center py-16 text-stone-400 border border-dashed border-stone-200 rounded-2xl">
          {isBroker ? 'No deals yet — post your first deal to get bids.' : 'No open deals right now. Check back soon.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deals.map((d) => <DealCard key={d.id} deal={d} />)}
        </div>
      )}
    </div>
  );
}