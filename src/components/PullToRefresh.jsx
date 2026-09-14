import React, { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function PullToRefresh({ onRefresh, children }) {
  const isMobile = useIsMobile();
  const [pulling, setPulling] = useState(false);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const readyRef = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!isMobile) return;
    const onTouchStart = (e) => {
      if (window.scrollY <= 0) startY.current = e.touches[0].clientY;
      else startY.current = null;
    };
    const onTouchMove = (e) => {
      if (startY.current === null || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
        setPulling(true);
        const r = delta > 70;
        if (r !== readyRef.current) { readyRef.current = r; setReady(r); }
      } else if (readyRef.current) {
        readyRef.current = false; setReady(false); setPulling(false);
      }
    };
    const onTouchEnd = async () => {
      if (readyRef.current && !refreshingRef.current) {
        refreshingRef.current = true; setRefreshing(true);
        readyRef.current = false; setReady(false);
        setPulling(false);
        startY.current = null;
        try { await onRefreshRef.current?.(); } finally { refreshingRef.current = false; setRefreshing(false); }
      } else {
        readyRef.current = false; setReady(false); setPulling(false);
        startY.current = null;
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isMobile]);

  if (!isMobile) return children;
  return (
    <>
      {(pulling || refreshing) && (
        <div className="db-ptr-indicator" aria-hidden="true">
          {refreshing ? <div className="db-ptr-spinner"/> : <span className="db-ptr-arrow">{ready ? '↑' : '↓'}</span>}
          <span>{refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}</span>
        </div>
      )}
      {children}
    </>
  );
}