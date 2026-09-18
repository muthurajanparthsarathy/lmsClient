import React from 'react';
import { cn } from '@/lib/utils';

// One card + header pattern shared by every analytics panel so the four chart
// cards never drift apart: title, one-line description, optional meta row
// (e.g. the alert-dot legend), then the body.
export function ChartCard({
    title,
    description,
    meta,
    children,
    className,
}: {
    title: string;
    description?: React.ReactNode;
    meta?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('rounded-xl border border-hairline bg-surface p-5 shadow-xs', className)}>
            <div className="mb-4">
                <h3 className="text-md font-semibold text-heading">{title}</h3>
                {description ? <p className="mt-0.5 text-xs text-subtle">{description}</p> : null}
                {meta}
            </div>
            {children}
        </div>
    );
}
