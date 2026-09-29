'use client';
import { useEffect } from 'react';

// Applies the Super Admin brand palette to <html> only while a /superadmin
// route is mounted, and removes it on unmount. Toggling on <html> (rather than
// a wrapper div) ensures portaled UI — Dialog, Select, Dropdown content that
// renders at document.body — also picks up the console brand, and guarantees
// the LMS is never affected once you navigate away.
export default function ThemeScope() {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add('sa-theme');
    return () => el.classList.remove('sa-theme');
  }, []);
  return null;
}
