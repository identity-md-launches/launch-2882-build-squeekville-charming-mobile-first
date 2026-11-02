import type { CSSProperties } from "react";
export function Icon({
  name,
  size = 20,
  style,
}: {
  name:
    | "bolt"
    | "arrow"
    | "wallet"
    | "check"
    | "leaf"
    | "book"
    | "help"
    | "close"
    | "refresh"
    | "oven"
    | "water"
    | "lights";
  size?: number;
  style?: CSSProperties;
}) {
  const paths: Record<string, React.ReactNode> = {
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
    arrow: (
      <>
        <path d="M4 12h15M13 5l7 7-7 7" />
      </>
    ),
    wallet: (
      <>
        <path d="M20 7H5a2 2 0 0 1 0-4h12v4M4 7v12h16V7M20 11h-5v4h5" />
        <path d="M16 13h.01" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    leaf: (
      <>
        <path d="M19 3C6 2 1 10 6 16s16-2 13-13Z" />
        <path d="M4 21 15 8" />
      </>
    ),
    book: (
      <>
        <path d="M12 5C7 2 3 4 3 4v15s4-2 9 1c5-3 9-1 9-1V4s-4-2-9 1ZM12 5v15" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 3.2 2.4c-.7.3-.7 1.1-.7 1.6M12 17h.01" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    refresh: (
      <>
        <path d="M20 9a8 8 0 0 0-13-5L3 8M3 3v5h5M4 15a8 8 0 0 0 13 5l4-4M21 21v-5h-5" />
      </>
    ),
    oven: (
      <>
        <path d="M4 21V11a8 8 0 0 1 16 0v10ZM8 21v-7a4 4 0 0 1 8 0v7" />
        <path d="M10 7h4M2 21h20" />
      </>
    ),
    water: (
      <>
        <path d="M12 2C9 7 5 10 5 14a7 7 0 0 0 14 0c0-4-4-7-7-12ZM8 14a4 4 0 0 0 4 4" />
      </>
    ),
    lights: (
      <>
        <path d="M2 4c4 6 16 6 20 0M5 7v4M12 9v4M19 7v4" />
        <path d="M3 11h4v4H3zM10 13h4v4h-4zM17 11h4v4h-4z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
export function HamsterMark() {
  return (
    <svg viewBox="0 0 50 50" width="46" height="46" aria-hidden="true">
      <path
        d="M8 19C0 4 15 1 19 13M31 13C37 0 51 7 43 20"
        fill="#d49668"
        stroke="#694b36"
        strokeWidth="2"
      />
      <path
        d="M7 30c0-14 8-21 18-21s18 7 18 21c0 12-9 16-18 16S7 42 7 30Z"
        fill="#dfad77"
      />
      <path
        d="M25 45C7 45 7 24 17 25c4 1 4 4 8 4s4-3 8-4c10-1 10 20-8 20Z"
        fill="#fff2d8"
      />
      <circle cx="17" cy="24" r="2" fill="#483d2f" />
      <circle cx="33" cy="24" r="2" fill="#483d2f" />
      <path
        d="m22 30 3 2 3-2M25 32v3m-4 0c3 2 5 2 8 0"
        fill="none"
        stroke="#694b36"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <ellipse cx="12" cy="31" rx="4" ry="2.5" fill="#df9b87" />
      <ellipse cx="38" cy="31" rx="4" ry="2.5" fill="#df9b87" />
    </svg>
  );
}
