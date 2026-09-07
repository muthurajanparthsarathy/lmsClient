// Initials avatar for people cells — brand-wash tile, brand-strong letter,
// per the table anatomy in the design brief.
export function UserAvatar({
  name,
  size = "sm",
}: {
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizeCls = {
    // xs is the table-row size — 24px, sized against the grid's 44px row.
    xs: "w-6 h-6 text-2xs",
    sm: "w-8 h-8 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-11 h-11 text-md",
  }[size];
  return (
    <div
      className={`${sizeCls} rounded-full bg-brand-wash flex items-center justify-center flex-shrink-0`}
      aria-hidden="true"
    >
      <span className="font-semibold text-brand-strong leading-none">
        {name?.charAt(0)?.toUpperCase() || "?"}
      </span>
    </div>
  );
}
