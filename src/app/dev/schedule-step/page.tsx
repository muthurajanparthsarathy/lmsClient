import { notFound } from 'next/navigation';
import SchedulePreview from './SchedulePreview';

// Dev-only route. See SchedulePreview.tsx — it mounts the real ScheduleStep
// so the Availability layout can be measured at each breakpoint.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <SchedulePreview />;
}
