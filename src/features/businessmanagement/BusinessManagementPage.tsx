"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Business Management bookmarks open the matching Client Management
// workspace tab. Each tab keeps its existing route.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function BusinessManagementRedirect() {
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const tab = searchParams.get('tab')
        // replace, not push: the redirect must not become a Back-button trap.
        router.replace(tab === 'services'
            ? '/lms/pages/servicemapping'
            : '/lms/pages/clientmanagement')
    }, [router, searchParams])

    return null
}

// useSearchParams opts the tree into client-side rendering, which Next requires
// a Suspense boundary for. Nothing visible renders either way — the redirect
// fires before any content could.
export default function BusinessManagementPage() {
    return (
        <Suspense fallback={null}>
            <BusinessManagementRedirect />
        </Suspense>
    )
}
