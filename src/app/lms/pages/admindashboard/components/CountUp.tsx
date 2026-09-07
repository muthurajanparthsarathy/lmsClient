'use client';

import { useEffect, useState } from 'react';

// Animated integer count-up (requestAnimationFrame, ease-out-quart). Logic is
// unchanged from the original dashboard — extraction only.
export const CountUp = ({ end, duration = 1600, suffix = "" }: { end: number, duration?: number, suffix?: string }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let raf = 0;
        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4); // Ease out quart
            setCount(Math.floor(ease * end));
            if (progress < 1) raf = requestAnimationFrame(animate);
        };
        raf = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(raf);
    }, [end, duration]);

    return <span>{count.toLocaleString()}{suffix}</span>;
};
