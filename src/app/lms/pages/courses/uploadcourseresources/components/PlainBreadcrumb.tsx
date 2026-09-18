"use client";

import React from "react";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  textMain:  "#1a1a2e",
  textSub:   "#475569",
  textMuted: "#94a3b8",
  textHint:  "#cbd5e1",
  link:      "#f97316",
  linkHover: "#ea580c",
  border:    "#eef0f4",
  pageBg:    "#fafafb",
};

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface PlainCrumb {
  /** Text to display for this segment. */
  label: string;
  /**
   * If provided, the segment is rendered as a clickable link.
   * Omit to render as plain non-interactive text.
   */
  onClick?: () => void;
}

interface PlainBreadcrumbProps {
  crumbs: PlainCrumb[];
  /** Optional override for container padding / background. */
  style?: React.CSSProperties;
  /** Optional accessible label / hint shown before the crumbs. */
  prefix?: string;
}

// ─── PlainBreadcrumb ───────────────────────────────────────────────────────────
/**
 * Lightweight, no-frills breadcrumb. Plain text segments joined by a `>`
 * separator. Segments with an `onClick` render as clickable orange links;
 * segments without are plain muted text.
 *
 * Used across NotionResourceModal, PageCreationModal, the URL/Reference
 * UploadModal, and the FolderBuilder modal so the user always knows where
 * the resource they're creating will be saved.
 */
export const PlainBreadcrumb: React.FC<PlainBreadcrumbProps> = ({ crumbs, style, prefix }) => {
  if (!crumbs || crumbs.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 px-4 py-2 flex-shrink-0"
      style={{
        borderBottom: `1px solid ${T.border}`,
        background: T.pageBg,
        fontFamily: "'Poppins', -apple-system, sans-serif",
        ...style,
      }}
    >
      {prefix && (
        <span
          className="text-[11px] font-semibold mr-1"
          style={{ color: T.textMuted, letterSpacing: "0.01em" }}
        >
          {prefix}
        </span>
      )}
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        const isClickable = typeof c.onClick === "function" && !isLast;
        return (
          <React.Fragment key={`${i}-${c.label}`}>
            {i > 0 && (
              <span
                className="text-[11px] flex-shrink-0 select-none"
                style={{ color: T.textHint }}
              >
                {">"}
              </span>
            )}
            {isClickable ? (
              <button
                type="button"
                onClick={c.onClick}
                className="text-[11.5px] font-semibold leading-snug transition-colors cursor-pointer"
                style={{
                  color: T.link,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  textDecoration: "none",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = T.linkHover;
                  (e.currentTarget as HTMLElement).style.textDecoration = "underline";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = T.link;
                  (e.currentTarget as HTMLElement).style.textDecoration = "none";
                }}
                title={c.label}
              >
                {c.label}
              </button>
            ) : (
              <span
                className="text-[11.5px] font-semibold leading-snug"
                style={{
                  color: isLast ? T.textMain : T.textSub,
                }}
                title={c.label}
              >
                {c.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default PlainBreadcrumb;
