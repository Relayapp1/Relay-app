import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Store, Car, User } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const SCROLL_KEY = 'relay_tab_scroll';
const STACK_KEY = 'relay_tab_stacks';
const TAB_ROOTS = ['/', '/admin', '/trips', '/profile'];

// '/admin' groups under the Marketplace tab's identity — it's the owner's
// equivalent of the marketplace home — but callers that need the literal
// current path (to avoid bouncing through '/' and racing DriveBid's
// owner redirect back to '/admin') should use location.pathname directly.
const tabForPath = (path) => {
  if (path.startsWith('/trips')) return '/trips';
  if (path.startsWith('/profile')) return '/profile';
  return '/';
};

export default function MobileTabBar() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef({});
  const stacks = useRef({});
  const activeTab = useRef('/');
  const switching = useRef(false);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(SCROLL_KEY);
      if (s) scrollRef.current = JSON.parse(s);
      const st = sessionStorage.getItem(STACK_KEY);
      if (st) stacks.current = JSON.parse(st);
    } catch (e) {}
    TAB_ROOTS.forEach(r => { if (!stacks.current[r]) stacks.current[r] = [r]; });
    activeTab.current = tabForPath(location.pathname);
  }, []);

  const persist = () => {
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrollRef.current));
      sessionStorage.setItem(STACK_KEY, JSON.stringify(stacks.current));
    } catch (e) {}
  };

  useEffect(() => {
    if (switching.current) {
      switching.current = false;
      activeTab.current = tabForPath(location.pathname);
    } else {
      const tab = activeTab.current;
      const stack = stacks.current[tab] || (stacks.current[tab] = [tab]);
      if (stack[stack.length - 1] !== location.pathname) { stack.push(location.pathname); persist(); }
      activeTab.current = tabForPath(location.pathname);
    }
    const savedY = scrollRef.current[location.pathname];
    if (savedY !== undefined) requestAnimationFrame(() => window.scrollTo(0, savedY));
  }, [location.pathname]);

  const handleTabClick = (path) => {
    scrollRef.current[location.pathname] = window.scrollY;
    if (path === activeTab.current) {
      // Re-tapping the active tab resets its stack and scrolls to top. For
      // an owner on /admin (which shares the Marketplace tab's identity),
      // resetting to the literal '/' would bounce through DriveBid's
      // client-side owner redirect back to /admin — wasteful, and prone to
      // racing a fast follow-up tap on another tab. Reset to wherever this
      // tab's root actually is instead.
      const resetTo = location.pathname === '/admin' ? '/admin' : path;
      stacks.current[path] = [resetTo];
      persist();
      if (location.pathname !== resetTo) {
        switching.current = true;
        navigate(resetTo, { replace: true });
      } else {
        window.scrollTo(0, 0);
      }
      return;
    }
    const outTab = activeTab.current;
    const outStack = stacks.current[outTab] || (stacks.current[outTab] = [outTab]);
    if (outStack[outStack.length - 1] !== location.pathname) outStack.push(location.pathname);
    const inStack = stacks.current[path] || (stacks.current[path] = [path]);
    persist();
    switching.current = true;
    navigate(inStack[inStack.length - 1] || path);
  };

  if (!isMobile) return null;
  const tabs = [
    { to: '/', label: 'Marketplace', icon: Store, end: true },
    { to: '/trips', label: 'Trips', icon: Car },
    { to: '/profile', label: 'Profile', icon: User }
  ];
  return (
    <nav className="db-mobile-tabs" aria-label="Mobile navigation">
      {tabs.map(t => {
        const Icon = t.icon;
        const active = tabForPath(location.pathname) === t.to;
        return (
          <a key={t.to} href={t.to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} aria-label={t.label} onClick={(e) => { e.preventDefault(); handleTabClick(t.to); }}>
            <Icon aria-hidden="true" />
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}