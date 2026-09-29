import React, { createContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './AssignmentSettings.module.css';
import { pageZoom } from '@/lib/pageZoom';

export const CompactSettingsContext = createContext(false);

export function SettingsHelp({ content }: { content: string }) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !tipRef.current) return;
    const anchor = buttonRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    // Placed in on-screen pixels, then converted: the page zoom scales the
    // style again, which left the tip short of its "?" button.
    const z = pageZoom();
    setPosition({
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - tip.width - 8)) / z,
      top: (anchor.bottom + tip.height + 12 < window.innerHeight
        ? anchor.bottom + 8 : Math.max(8, anchor.top - tip.height - 8)) / z,
    });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return <span className={styles.helpWrap} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button type="button" ref={buttonRef} className={styles.help} aria-label={content}
      aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={() => setOpen(previous => !previous)}>?</button>
    {open && createPortal(<div ref={tipRef} id={id} role="tooltip" className={styles.tooltip}
      style={position}>{content}</div>, document.body)}
  </span>;
}
