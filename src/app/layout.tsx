import type { Metadata } from 'next'

import './globals.css'
import { ThemeProvider } from '@/components/ui/themeprovider'
import { Providers } from './providers'
import { ToastContainer } from 'react-toastify'
import { Toaster } from 'react-hot-toast'
import { NavigationLoaderProvider } from '@/components/navigation-loader/NavigationLoaderProvider'
import { RadixPointerEventsGuard } from '@/components/RadixPointerEventsGuard'

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
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (e.g. LocatorJS) inject
          attributes into <head> before React hydrates */}
      <head suppressHydrationWarning>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500&display=swap"
          rel="stylesheet"
        />
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