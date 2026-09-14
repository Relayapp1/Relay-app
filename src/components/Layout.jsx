import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Truck, LayoutDashboard, Package, User, LogOut, Menu, X, Gavel, ShieldCheck } from 'lucide-react';

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isBroker = user?.account_type === 'broker';
  const isAdmin = user?.role === 'admin';

  const nav = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Deals', path: '/deals', icon: Package },
    ...(isBroker ? [{ label: 'Post a Deal', path: '/post-deal', icon: Gavel }] : []),
    ...(isAdmin ? [{ label: 'Review Drivers', path: '/admin/drivers', icon: ShieldCheck }] : []),
    { label: 'Profile', path: '/profile', icon: User },
  ];

  const handleLogout = () => base44.auth.logout();

  const NavItems = () => (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = location.pathname === item.path;
        return (
          <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}>
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-stone-50 flex">
      <aside className="hidden md:flex w-64 bg-slate-900 flex-col p-5 fixed h-full">
        <Link to="/" className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center">
            <Truck className="w-5 h-5 text-slate-900" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Relay</span>
        </Link>
        <div className="flex-1"><NavItems /></div>
        <div className="border-t border-white/10 pt-4">
          <div className="px-4 mb-3">
            <p className="text-white text-sm font-medium truncate">{user?.full_name || user?.email || 'Member'}</p>
            <p className="text-white/40 text-xs capitalize">{user?.account_type || 'driver'}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all w-full">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 bg-slate-900 z-40 flex items-center justify-between px-4 h-14">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
            <Truck className="w-4 h-4 text-slate-900" />
          </div>
          <span className="text-white font-semibold">Relay</span>
        </Link>
        <button onClick={() => setOpen(!open)} className="text-white p-2">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 top-14 bg-slate-900 z-30 p-5" onClick={() => setOpen(false)}>
          <NavItems />
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 mt-4 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 w-full">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}

      <main className="flex-1 md:ml-64 pt-14 md:pt-0 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}