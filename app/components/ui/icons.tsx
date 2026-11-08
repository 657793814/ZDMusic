"use client";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    focusable: false,
    "aria-hidden": true,
    ...props,
  } as SVGProps<SVGSVGElement>;
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 5l12 7-12 7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M15 5l-7 7 7 7" />
      </g>
    </svg>
  );
}

export function StageIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <rect x="3" y="4.5" width="18" height="12.5" rx="2.5" />
        <path d="M8.5 20.5h7" />
      </g>
    </svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M12 3l1.7 4.6 4.6 1.7-4.6 1.7L12 15.6l-1.7-4.6L5.7 9.3l4.6-1.7z" />
        <path d="M18.5 15.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" />
      </g>
    </svg>
  );
}

export function AiIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M8 4.5h8.5A3.5 3.5 0 0 1 20 8v6a3.5 3.5 0 0 1-3.5 3.5h-3.3L9 21v-3.5H8A3.5 3.5 0 0 1 4.5 14V8A3.5 3.5 0 0 1 8 4.5Z" />
        <path d="M12 7.4l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
      </g>
    </svg>
  );
}

export function LyricIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M4.5 6.5h9M4.5 11.5h7.5M4.5 16.5h5.5" />
        <path d="M18 8.5v8.2" />
        <circle cx="16.2" cy="17.6" r="1.9" />
      </g>
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 4v10" />
        <path d="M7.5 9.5L12 14l4.5-4.5" />
        <path d="M4.5 17.5v1.5a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v-1.5" />
      </g>
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PrevIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 5L9 12l10 7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function NextIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M17 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 5l10 7-10 7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M4 6h3.2l9.6 12H20" />
        <path d="M4 18h3.2l9.6-12H20" />
        <path d="M18 4l3 2-3 2" />
        <path d="M18 16l3 2-3 2" />
      </g>
    </svg>
  );
}

export function RepeatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M5 10V8a3 3 0 0 1 3-3h9" />
        <path d="M17 3l2 2-2 2" />
        <path d="M19 14v2a3 3 0 0 1-3 3H7" />
        <path d="M7 21l-2-2 2-2" />
      </g>
    </svg>
  );
}

export function VolumeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M4 9v6h3l4 3V6l-4 3z" fill="currentColor" stroke="none" />
        <path d="M15 9a4 4 0 0 1 0 6" />
        <path d="M17.5 6.5a8 8 0 0 1 0 11" />
      </g>
    </svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M5 7h14M5 12h14M5 17h9" />
      </g>
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M7 7l10 10M17 7l-10 10" />
      </g>
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M12 6v12M6 12h12" />
      </g>
    </svg>
  );
}

export function MusicIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <circle cx="7" cy="17" r="3" />
        <circle cx="17" cy="15" r="3" />
        <path d="M10 17V7l10-2v10" />
      </g>
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <circle cx="11" cy="11" r="6" />
        <path d="M16 16l4 4" />
      </g>
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18" />
      </g>
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M9 4h6l1 6 3 2v1H5v-1l3-2 1-6z" />
        <path d="M12 13v7" />
      </g>
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />
      </g>
    </svg>
  );
}

export function LocateIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      </g>
    </svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M14 5h5v5M19 5l-7 7" />
        <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
      </g>
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
      </g>
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
        <path d="M13 7l4 4" />
      </g>
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <rect x="9" y="3.5" width="6" height="11" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
        <path d="M12 18v2.5M9.5 20.5h5" />
      </g>
    </svg>
  );
}
