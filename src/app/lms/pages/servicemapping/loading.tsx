// Content-only: the workspace tab strip is mounted by the shared layout above
// this boundary and stays put, so the skeleton must not draw its own tab bar.
import ClientWorkspaceSkeleton from '@/features/businessmanagement/ClientWorkspaceSkeleton'

export default function Loading() {
    return <ClientWorkspaceSkeleton showTabs={false} />
}
