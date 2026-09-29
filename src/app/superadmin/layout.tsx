import React from 'react';
import './superadmin-theme.css';
import ThemeScope from './_components/ThemeScope';

// Root layout for the entire Super Admin module (login + app). Activates the
// console's own brand palette while any /superadmin route is mounted.
export default function SuperAdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeScope />
      {children}
    </>
  );
}
