import { notFound } from 'next/navigation'
import LiveInteractiveCompilerPage from '@/app/lms/pages/live-intract-compailer/page'

// Dev-only harness (public under /dev/ outside production): renders the Live
// Interactive Compiler without a login so its editor → Run path can be tested.
export default function Page() {
    if (process.env.NODE_ENV === 'production') notFound()
    return <LiveInteractiveCompilerPage />
}
