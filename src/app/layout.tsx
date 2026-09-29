import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'

import './globals.css'
import { ThemeProvider } from '@/components/ui/themeprovider'
import { Providers } from './providers'
import { ToastContainer } from 'react-toastify'
import { Toaster } from 'react-hot-toast'
import { NavigationLoaderProvider } from '@/components/navigation-loader/NavigationLoaderProvider'
import { RadixPointerEventsGuard } from '@/components/RadixPointerEventsGuard'

// Self-hosted Poppins for the WHOLE app, not just the shells that opted in.
//
// Before this: the admin (component/layout.tsx) and staff shells declared
// their own next/font Poppins and pinned it with an inline fontFamily. Every
// other page — the student shell, the login route, the L&D console, the
// program-coordinator shell, and even the moments during an admin route when
// the shell hadn't mounted yet — fell through to the body-level 'Poppins'
// declared in globals.css, which was served by the Google Fonts <link> below.
// Whenever that CDN copy wasn't loaded yet, the fallback was Segoe UI on
// Windows — a face with a noticeably larger x-height than Poppins at the same
// pixel size, so identical Tailwind classes rendered at visibly different
// sizes across routes (the student rail vs the admin rail was the case that
// prompted this). Two independent Poppins() calls also fetched the font
// TWICE.
//
// Declaring it once at the root gives every page the same self-hosted face
// with next/font's metric-adjusted fallback (measured to match Poppins so
// swap-in is invisible), and lets the per-shell font-family inlines fall away
// over time.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: 'LMS - Learning Management System',
  description: 'A modern learning management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={poppins.variable}>
      {/* suppressHydrationWarning: browser extensions (e.g. LocatorJS) inject
          attributes into <head> before React hydrates */}
      <head suppressHydrationWarning>
        {/* Google Fonts preconnect kept for react-toastify / react-hot-toast
            and any legacy inline `fontFamily: 'Poppins'` fallbacks, but the
            stylesheet <link> is removed — next/font above self-hosts the same
            weights and duplicating them cost a second download and a swap
            flash. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      {/* Same reason as <head>: extensions (ColorZilla adds cz-shortcut-listen)
          stamp attributes onto <body> before React hydrates, and the mismatch
          warning they trigger buries real errors during development. */}
      <body className="font-sans" suppressHydrationWarning>
        {/* next-themes owns html.dark now (the trainer navbar's manual toggle
            is gone). storageKey "theme" matches the key that toggle wrote, so
            existing saved preferences carry over. defaultTheme is "light", not
            "system", to preserve the old behavior for areas that never had a
            dark init (admin, student, login): dark only when explicitly chosen
            via the sidebar theme controls. */}
        <ThemeProvider attribute="class" defaultTheme="light" storageKey="theme" disableTransitionOnChange>
        <RadixPointerEventsGuard />
        <Providers>
          <NavigationLoaderProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '13px',
                },
              }}
              containerStyle={{
                zIndex: 99999,
              }}
            />
            {children}
          </NavigationLoaderProvider>
        </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
