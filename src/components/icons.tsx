/** Small inline SVG icons — original, no external assets. */

import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

function Base({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconRepair({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z" />
    </Base>
  );
}

export function IconReplacement({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v9h14v-9" />
      <path d="M9 19v-5h6v5" />
    </Base>
  );
}

export function IconInspection({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
      <path d="M11 8v6M8 11h6" />
    </Base>
  );
}

export function IconGutter({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M3 12h18" />
      <path d="M6 12v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-3" />
      <path d="M12 3v3" />
    </Base>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Base>
  );
}

export function IconPhone({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </Base>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Base>
  );
}

export function IconStar({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2Z" />
    </svg>
  );
}
