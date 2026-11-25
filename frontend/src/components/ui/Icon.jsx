// Inline stroke icons (24×24 grid). Usage: <Icon name="leaf" size={20} />
const PATHS = {
  leaf: (
    <>
      <path d="M12 21V11" />
      <path d="M12 11C12 6 8 3 4 3c0 5 3 8 8 8z" />
      <path d="M12 14c0-4 3-7 8-7 0 4-3 7-8 7z" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  camera: (
    <>
      <path d="M4 7h3l2-3h6l2 3h3v12H4z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  check: <path d="M5 12l5 5 9-10" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
  tree: (
    <>
      <path d="M12 22v-6" />
      <path d="M7.5 16h9a4 4 0 0 0 1.2-7.8A5.5 5.5 0 0 0 6.3 8.2 4 4 0 0 0 7.5 16z" />
    </>
  ),
  shrub: (
    <>
      <path d="M3 20h18" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="M9 14.5a3 3 0 0 1 6 0" />
    </>
  ),
  palm: (
    <>
      <path d="M12.5 22c0-5 .5-9 .5-13" />
      <path d="M13 9C11 5 7 4 3 6" />
      <path d="M13 9c2-4 6-5 9-3" />
      <path d="M13 9c-3-1-7 1-8 5" />
      <path d="M13 9c3-1 6 1 7 5" />
    </>
  ),
};

export default function Icon({ name, size = 20, strokeWidth = 1.8, className, title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {PATHS[name] || null}
    </svg>
  );
}
