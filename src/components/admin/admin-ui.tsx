import type { ReactNode } from "react";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AdminPageHeader({
  action,
  description,
  eyebrow,
  status,
  title,
}: {
  action?: ReactNode;
  description: ReactNode;
  eyebrow?: string;
  status?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-[#dfd3bf] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7526]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 break-words text-[30px] leading-tight text-[#142842] sm:text-[34px]">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5b6c7c]">{description}</p>
      </div>
      {action || status ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {status}
          {action}
        </div>
      ) : null}
    </header>
  );
}

export function AdminStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "error" | "info" | "neutral" | "success" | "warning";
}) {
  return (
    <span
      className={classes(
        "inline-flex min-h-8 w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "success" && "border-[#b9dec8] bg-[#e8f1eb] text-[#2f6b4f]",
        tone === "warning" && "border-[#e5cb8c] bg-[#f7ecd4] text-[#80631e]",
        tone === "error" && "border-[#e6bdb6] bg-[#f7e6e3] text-[#9a3e35]",
        tone === "info" && "border-[#c8d6e3] bg-[#e9eef2] text-[#344d68]",
        tone === "neutral" && "border-[#dedbd3] bg-[#eff1f2] text-[#5b6c7c]",
      )}
    >
      <span aria-hidden="true" className="text-[9px]">●</span>
      {children}
    </span>
  );
}

export function AdminMetricCard({
  label,
  progress,
  subtitle,
  value,
}: {
  label: string;
  progress?: number;
  subtitle: string;
  value: ReactNode;
}) {
  const safeProgress = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));

  return (
    <article className="min-w-0 rounded-[10px] border border-[#e4d8c4] bg-[#fffdf8] px-4 py-4 shadow-[0_1px_2px_rgba(20,40,66,0.025)]">
      <p className="text-xs font-semibold text-[#5b6c7c]">{label}</p>
      <p className="mt-1.5 break-words text-3xl font-bold tracking-tight text-[#142842]">{value}</p>
      {safeProgress !== undefined ? (
        <div
          aria-label={`${safeProgress}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={safeProgress}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e9e3d8]"
          role="progressbar"
        >
          <div className="h-full rounded-full bg-[#9a7526]" style={{ width: `${safeProgress}%` }} />
        </div>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-[#637487]">{subtitle}</p>
    </article>
  );
}

export function AdminEmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[10px] border border-dashed border-[#d8cbb6] bg-[#fffdf8] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-[#142842]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[#5b6c7c]">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminFeedback({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "error" | "success" | "warning";
}) {
  return (
    <div
      className={classes(
        "rounded-[10px] border p-4 text-sm leading-6",
        tone === "success" && "border-[#b9dec8] bg-[#e8f1eb] text-[#2f6b4f]",
        tone === "warning" && "border-[#e5cb8c] bg-[#fff9eb] text-[#80631e]",
        tone === "error" && "border-[#ead3cc] bg-[#fff5f2] text-[#9a3e35]",
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
