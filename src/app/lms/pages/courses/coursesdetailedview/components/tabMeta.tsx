// components/tabMeta.tsx
import { Target, Users, BookOpen } from "lucide-react"

export const TAB_META = {
  I_Do: {
    label: "I Do",
    icon: <Target size={13} strokeWidth={2.5} />,
    color: "#dc2626",
    bg: "rgba(220,38,38,0.09)",
    shadow: "rgba(220,38,38,0.36)",
  },
  We_Do: {
    label: "We Do",
    icon: <Users size={13} strokeWidth={2.5} />,
    color: "#ea580c",
    bg: "rgba(234,88,12,0.09)",
    shadow: "rgba(234,88,12,0.36)",
  },
  You_Do: {
    label: "You Do",
    icon: <BookOpen size={13} strokeWidth={2.5} />,
    color: "#059669",
    bg: "rgba(5,150,105,0.09)",
    shadow: "rgba(5,150,105,0.36)",
  },
} as const