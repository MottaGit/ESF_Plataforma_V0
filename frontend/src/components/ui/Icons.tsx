interface IconProps {
  size?: number;
  className?: string;
}

function svg(path: JSX.Element, { size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) =>
  svg(
    <>
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>,
    p
  );

export const IconProjects = (p: IconProps) =>
  svg(
    <>
      <path d="M3 7.5 12 3l9 4.5-9 4.5z" />
      <path d="m3 12 9 4.5L21 12" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </>,
    p
  );

export const IconVolunteers = (p: IconProps) =>
  svg(
    <>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.85" />
      <path d="M16.5 4.2a3.2 3.2 0 0 1 0 5.9" />
    </>,
    p
  );

export const IconReports = (p: IconProps) =>
  svg(
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>,
    p
  );

export const IconSettings = (p: IconProps) =>
  svg(
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h8M16 18h4" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="14" cy="18" r="2" />
    </>,
    p
  );

export const IconSearch = (p: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </>,
    p
  );

export const IconPlus = (p: IconProps) => svg(<path d="M12 5v14M5 12h14" />, p);

export const IconMenu = (p: IconProps) => svg(<path d="M4 7h16M4 12h16M4 17h16" />, p);

export const IconClose = (p: IconProps) => svg(<path d="M6 6l12 12M18 6 6 18" />, p);

export const IconTrash = (p: IconProps) =>
  svg(
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </>,
    p
  );

export const IconEdit = (p: IconProps) =>
  svg(
    <>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M14.5 6.5 17.5 9.5" />
    </>,
    p
  );

export const IconDownload = (p: IconProps) =>
  svg(
    <>
      <path d="M12 4v11" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 20h14" />
    </>,
    p
  );

export const IconUpload = (p: IconProps) =>
  svg(
    <>
      <path d="M12 19V8" />
      <path d="m8 12 4-4 4 4" />
      <path d="M5 4h14" />
    </>,
    p
  );

export const IconLogout = (p: IconProps) =>
  svg(
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 16 6 12l4-4" />
      <path d="M6 12h9" />
    </>,
    p
  );

export const IconMapPin = (p: IconProps) =>
  svg(
    <>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>,
    p
  );

export const IconCalendar = (p: IconProps) =>
  svg(
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>,
    p
  );

export const IconCheck = (p: IconProps) => svg(<path d="m5 13 4.5 4.5L19 7" />, p);

export const IconChevronLeft = (p: IconProps) => svg(<path d="m14 6-6 6 6 6" />, p);

export const IconAlert = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.2v.3" />
    </>,
    p
  );
