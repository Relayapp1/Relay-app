import React, { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

export default function MobileSelect({ value, defaultValue, onChange, children, name, placeholder, title, className, required }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue ?? '');
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const options = React.Children.toArray(children).filter(Boolean).map(child => {
    const v = child.props.value !== undefined ? child.props.value : child.props.children;
    return { value: v, label: child.props.children };
  });
  const selected = options.find(o => String(o.value) === String(current));

  const commit = (v) => { if (!controlled) setInternal(v); onChange?.(v); };

  if (!isMobile) {
    return (
      <select
        name={name}
        value={controlled ? current : undefined}
        defaultValue={controlled ? undefined : defaultValue}
        onChange={e => commit(e.target.value)}
        className={className}
        required={required}
      >{children}</select>
    );
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current ?? ''} />}
      <button type="button" className="db-mobile-select-trigger" onClick={() => setOpen(true)}>
        <span>{selected ? selected.label : (placeholder || 'Select…')}</span>
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title || placeholder || 'Select an option'}</DrawerTitle>
          </DrawerHeader>
          <div className="db-mobile-select-list">
            {options.map(o => {
              const active = String(o.value) === String(current);
              return (
                <button key={String(o.value)} type="button" className={`db-mobile-select-option ${active ? 'active' : ''}`} onClick={() => { commit(o.value); setOpen(false); }}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}