"use client"

/* Route wrapper. The screen itself lives beside this file so other shells
   (the L&D console) can host it — Next allows no extra named exports from
   a page module. */
import ProgramCalendarContent from "./ProgramCalendarContent"

export default function ProgramCalendarPage() {
    return <ProgramCalendarContent />
}
