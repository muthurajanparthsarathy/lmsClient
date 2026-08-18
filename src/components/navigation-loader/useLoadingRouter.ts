'use client';

// Optional convenience hook.
//
// The provider's history.pushState patch already means plain useRouter().push
// triggers the global loader — so 99% of the app needs no change. Reach for
// this hook only when you want explicit control (e.g. to guarantee a loader
// even if the patch is unavailable, or to keep the loader up during a chained
// server action followed by a router.refresh).

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useNavigationLoader } from './NavigationLoaderProvider';

export function useLoadingRouter() {
  const router = useRouter();
  const { start } = useNavigationLoader();

  return useMemo(() => ({
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => {
      start();
      return router.push(href, options);
    },
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => {
      start();
      return router.replace(href, options);
    },
    back: () => {
      start();
      return router.back();
    },
    forward: () => {
      start();
      return router.forward();
    },
    refresh: () => {
      start();
      return router.refresh();
    },
  }), [router, start]);
}
