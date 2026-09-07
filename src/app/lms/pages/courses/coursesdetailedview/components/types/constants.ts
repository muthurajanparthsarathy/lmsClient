// constants.ts
import { Target, Users, BookOpen } from "lucide-react"
import React from "react"

export const FONT_PRIMARY = "'Poppins','Poppins','Roboto',system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
// Kept the historic export name so existing imports don't break — now loads Poppins.
export const FONT_INTER_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');"

export const T = {
  orange:      '#F97316',
  orangeDark:  '#EA580C',
  orangeGlow:  'rgba(249,115,22,0.22)',
  orangeLight: 'rgba(249,115,22,0.08)',
  orangeTint:  'rgba(249,115,22,0.06)',
  textMain:    '#0F172A',
  textSub:     '#334155',
  textMuted:   '#64748B',
  textHint:    '#CBD5E1',
  border:      '#E2E8F0',
  bg:          '#FFFFFF',
  bgRightSidebar:'#F97316',
  pageBg:      '#F8FAFC',
  ink:         '#0F172A',
  inkSub:      '#334155',
  inkMuted:    '#64748B',
  inkFaint:    '#CBD5E1',
  line:        '#E2E8F0',
  surface:     '#F8FAFC',
}

// Convert to functions that return JSX elements
export const getTabMeta = () => ({
  I_Do: {
    label: "I Do",
    getIcon: () => React.createElement(Target, { size: 13, strokeWidth: 2.5 }),
    color: "#dc2626",
    bg: "rgba(220,38,38,0.09)",
    shadow: "rgba(220,38,38,0.36)",
  },
  We_Do: {
    label: "We Do",
    getIcon: () => React.createElement(Users, { size: 13, strokeWidth: 2.5 }),
    color: "#ea580c",
    bg: "rgba(234,88,12,0.09)",
    shadow: "rgba(234,88,12,0.36)",
  },
  You_Do: {
    label: "You Do",
    getIcon: () => React.createElement(BookOpen, { size: 13, strokeWidth: 2.5 }),
    color: "#059669",
    bg: "rgba(5,150,105,0.09)",
    shadow: "rgba(5,150,105,0.36)",
  },
})

// Or export as React components directly
export const TAB_META_ICONS = {
  I_Do: () => React.createElement(Target, { size: 13, strokeWidth: 2.5 }),
  We_Do: () => React.createElement(Users, { size: 13, strokeWidth: 2.5 }),
  You_Do: () => React.createElement(BookOpen, { size: 13, strokeWidth: 2.5 }),
}

export const DEPTH_CFG = [
  { accentColor:'#F97316', iconColor:'#EA580C', iconBg:'rgba(249,115,22,.10)',
    iconBox:26, iconRadius:8, iconStroke:14,
    textColor:'#0F172A', textSize:'12.5px', textWeight:650, paddingV:7, dot:'#F97316' },
  { accentColor:'#7C6FF7', iconColor:'#5C52D9', iconBg:'rgba(124,111,247,.09)',
    iconBox:24, iconRadius:7, iconStroke:13,
    textColor:'#27243D', textSize:'12px', textWeight:550, paddingV:6, dot:'#7C6FF7' },
  { accentColor:'#0EA5A0', iconColor:'#0D8A85', iconBg:'rgba(14,165,160,.08)',
    iconBox:22, iconRadius:6, iconStroke:12,
    textColor:'#1C3534', textSize:'11.5px', textWeight:500, paddingV:5, dot:'#0EA5A0' },
  { accentColor:'#D97706', iconColor:'#B45309', iconBg:'rgba(217,119,6,.07)',
    iconBox:20, iconRadius:5, iconStroke:11,
    textColor:'#3D2A00', textSize:'11px', textWeight:450, paddingV:4, dot:'#D97706' },
] as const

export const METHOD_CFG = {
  'i-do':   { label:'I Do',   emoji:'🎯', color:'#F97316', dark:'#EA580C', bg:'rgba(249,115,22,.08)',  border:'rgba(249,115,22,.30)',  grad:'linear-gradient(135deg,#F97316,#EA580C)' },
  'we-do':  { label:'We Do',  emoji:'🤝', color:'#7C6FF7', dark:'#5C52D9', bg:'rgba(124,111,247,.08)', border:'rgba(124,111,247,.30)', grad:'linear-gradient(135deg,#7C6FF7,#5C52D9)' },
  'you-do': { label:'You Do', emoji:'🚀', color:'#0EA5A0', dark:'#0D8A85', bg:'rgba(14,165,160,.08)',  border:'rgba(14,165,160,.30)',  grad:'linear-gradient(135deg,#0EA5A0,#0D8A85)' },
} as const

export const RES_COLOR: Record<string,string> = {
  page:'#6366f1', video:'#ef4444', ppt:'#f97316',
  pdf:'#dc2626', zip:'#16a34a', link:'#9333ea', reference:'#64748b', image:'#06b6d4', word:'#2563eb', txt:'#64748b',
}

export const RES_LABEL: Record<string,string> = {
  all:"All", video:"Video", pdf:"PDF", ppt:"Slides",
  zip:"ZIP", link:"Link", reference:"Ref", page:"Page", image:"Image", word:"Doc", txt:"Text"
}