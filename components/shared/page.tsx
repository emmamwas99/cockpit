"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The building blocks every admin screen is made of, so they all read alike:
 * a page header, stat cards, count tabs, a search box, an empty state and the
 * avatar-and-name cell.
 */

// ── Page header ──────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

/** Percent change from `previous` to `current`; null when there is no base to compare. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** "↑ 12%" in green, "↓ 4%" in red, with the arrow carrying direction too. */
export function Delta({ change, suffix }: { change: number | null; suffix?: string }) {
  if (change === null) {
    return <span className="text-xs text-muted">New {suffix && <span>{suffix}</span>}</span>;
  }
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium tabular-nums",
          change > 0 ? "text-success" : change < 0 ? "text-error" : "text-muted",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {Math.abs(change)}%
      </span>
      {suffix && <span className="text-muted">{suffix}</span>}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  change,
  changeSuffix,
  href,
  loading,
}: {
  label: string;
  value?: React.ReactNode;
  hint?: React.ReactNode;
  change?: number | null;
  changeSuffix?: string;
  href?: string;
  loading?: boolean;
}) {
  const body = (
    <>
      <p className="text-[13px] text-muted">{label}</p>
      {loading || value === undefined ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      )}
      {(change !== undefined || hint) && !loading && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {change !== undefined && <Delta change={change} suffix={changeSuffix} />}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </>
  );
  const className = "block rounded-xl border border-border bg-elevated p-4";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:border-border-strong")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// ── Count tabs ───────────────────────────────────────────────────────────────

export interface CountTab<K extends string = string> {
  key: K;
  label: string;
  count?: number;
  href?: string;
  /** Counts that mean "work waiting" stay highlighted even when not selected. */
  attention?: boolean;
}

/** Underline tabs, each with its count, scrolling sideways on narrow screens. */
export function CountTabs<K extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: CountTab<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  return (
    <div className={cn("-mb-px flex gap-1 overflow-x-auto", className)} role="tablist">
      {tabs.map((tab) => {
        const active = tab.key === value;
        const highlighted = tab.attention && (tab.count ?? 0) > 0;
        const tabClassName = cn(
          "flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors",
          active
            ? "border-primary font-medium text-foreground"
            : "border-transparent text-muted hover:text-foreground",
        );
        const contents = (
          <>
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-md px-1.5 text-xs tabular-nums",
                  active || highlighted
                    ? "bg-primary-soft font-medium text-primary-strong"
                    : "bg-subtle text-muted",
                )}
              >
                {formatNumber(tab.count)}
              </span>
            )}
          </>
        );

        if (tab.href) {
          return (
            <Link
              key={tab.key}
              href={tab.href}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.key)}
              className={tabClassName}
            >
              {contents}
            </Link>
          );
        }

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={tabClassName}
          >
            {contents}
          </button>
        );
      })}
    </div>
  );
}

/** A compact pill group for secondary filters, optionally with counts. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-subtle p-0.5" role="radiogroup">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] transition-colors",
              active
                ? "bg-elevated font-medium text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="tabular-nums text-xs text-muted">{formatNumber(option.count)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Search ───────────────────────────────────────────────────────────────────

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-border bg-elevated pl-9 pr-8 text-sm text-foreground placeholder:text-placeholder focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * The head of a list card: count tabs on their own row (they can be many),
 * then search and filters beneath, so neither ever squeezes the other.
 */
export function ListToolbar({
  tabs,
  children,
}: {
  tabs?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div>
      {tabs && <div className="border-b border-border px-4 pt-3">{tabs}</div>}
      {children && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">{children}</div>
      )}
    </div>
  );
}

// ── States ───────────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-subtle">
          <Icon className="size-5 text-muted" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

// ── People ───────────────────────────────────────────────────────────────────

export function Person({
  name,
  avatar,
  secondary,
  size = "md",
  className,
}: {
  name: string;
  avatar?: string | null;
  secondary?: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar src={avatar} name={name} className={size === "sm" ? "size-7" : "size-8"} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {secondary && <p className="truncate text-xs text-muted">{secondary}</p>}
      </div>
    </div>
  );
}

/** A row in a "needs attention" list: label, count and where to go. */
export function AttentionRow({
  icon: Icon,
  label,
  description,
  count,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  count?: number;
  href: string;
}) {
  const clear = count === 0;
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface"
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          clear ? "bg-subtle text-muted" : "bg-primary-soft text-primary-strong",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        {description && <p className="truncate text-xs text-muted">{description}</p>}
      </div>
      {count === undefined ? (
        <Skeleton className="h-5 w-8" />
      ) : (
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            clear ? "text-muted" : "text-foreground",
          )}
        >
          {clear ? "—" : formatNumber(count)}
        </span>
      )}
      <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
