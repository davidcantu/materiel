/**
 * Locked Materiel icon set — stroke SVGs matching kit sheets
 * (media/brand/kit/materiel-icons-sheet-*.jpg). Color via currentColor:
 * OD on light, sand/OD-muted on dark (see --icon in base.css).
 */

export type IconName =
  | 'dashboard'
  | 'inventory'
  | 'builds'
  | 'logs'
  | 'ammo'
  | 'loads'
  | 'maintenance'
  | 'settings'
  | 'add'
  | 'edit'
  | 'delete'
  | 'search'
  | 'filter'
  | 'upload'
  | 'info'
  | 'theme'
  | 'share'
  | 'warning'
  | 'success'
  | 'maintenanceDue'
  | 'licenseLocked'

type IconProps = {
  name: IconName
  className?: string
  size?: number
  title?: string
}

const STROKE = 1.75

function Svg({
  children,
  className,
  size,
  title
}: {
  children: React.ReactNode
  className?: string
  size: number
  title?: string
}): React.JSX.Element {
  return (
    <svg
      className={className ? `mi ${className}` : 'mi'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

function paths(name: IconName): React.ReactNode {
  switch (name) {
    case 'dashboard':
      return (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
          <rect x="6" y="6" width="4.5" height="4.5" rx="1" />
          <path d="M7 17.5V14M11 17.5V12M15 17.5V13.5M19 17.5V11" />
        </>
      )
    case 'inventory':
      return (
        <>
          <path d="M4.5 8.5 12 4.5l7.5 4v9.5L12 21.5 4.5 18z" />
          <path d="M4.5 8.5 12 12.5l7.5-4M12 12.5V21.5" />
          <path d="M8.2 10.4h7.6M8.2 13h5.2M8.2 15.5h4" />
        </>
      )
    case 'builds':
      return (
        <>
          <path d="M3.5 14.5h11.5l1.2-2.2h2.8l1.5 2.2H21" />
          <path d="M5 14.5V11h8.5v3.5" />
          <path d="M7.2 11V8.8h3.2V11" />
          <circle cx="7.2" cy="16.8" r="1.6" />
          <circle cx="16.2" cy="16.8" r="1.6" />
          <path d="M8.8 16.8h5.8" />
        </>
      )
    case 'logs':
      return (
        <>
          <path d="M8 4.5h9.5a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5H8A2.5 2.5 0 0 1 5.5 18V7A2.5 2.5 0 0 1 8 4.5z" />
          <path d="M5.5 8.5h3M9.5 11h6.5M9.5 14h6.5M9.5 17h4.5" />
        </>
      )
    case 'ammo':
      return (
        <>
          <path d="M4 18.5h16v1.5H4z" />
          <path d="M5.5 18.5V11h13v7.5" />
          <path d="M5.5 11 8 7.5h8l2.5 3.5" />
          <path d="M9 11V8.2M12 11V7.2M15 11V8.2" />
          <path d="M9 7.2 9.4 5.5h.8L11 7.2M11.6 7.2l.4-2.2h.8l.4 2.2M14.2 7.2l.4-1.7h.8l.4 1.7" />
        </>
      )
    case 'loads':
      return (
        <>
          <path d="M4 18.5h16" />
          <path d="M5.5 18.5V14h13v4.5" />
          <rect x="7" y="7" width="10" height="7" rx="1" />
          <path d="M7 10.5h10M9.5 7V5.5h5V7" />
          <path d="M9 14l3-3.5 3 3.5" />
        </>
      )
    case 'maintenance':
      return (
        <>
          <path d="M14.5 5.2a4.2 4.2 0 0 0-5.8 5.8L4.2 15.5a2 2 0 0 0 2.8 2.8l4.5-4.5a4.2 4.2 0 0 0 5.8-5.8l-2.4 2.4-2.2-2.2z" />
        </>
      )
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </>
      )
    case 'add':
      return (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
          <path d="M12 8v8M8 12h8" />
        </>
      )
    case 'edit':
      return (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
          <path d="M8.5 15.5 14.8 9.2l1.8 1.8-6.3 6.3H8.5z" />
          <path d="M13.5 10.5l1.8 1.8" />
        </>
      )
    case 'delete':
      return (
        <>
          <path d="M5 8h14" />
          <path d="M9.5 8V6.2A1.2 1.2 0 0 1 10.7 5h2.6a1.2 1.2 0 0 1 1.2 1.2V8" />
          <path d="M7.2 8l.8 11.2A1.5 1.5 0 0 0 9.5 20.5h5a1.5 1.5 0 0 0 1.5-1.3L16.8 8" />
          <path d="M10.2 11.5v5.5M13.8 11.5v5.5" />
        </>
      )
    case 'search':
      return (
        <>
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="M15 15.2 20 20" />
        </>
      )
    case 'filter':
      return (
        <>
          <path d="M4.5 6.5h15l-5.5 6.2V18l-4 2v-7.3z" />
        </>
      )
    case 'upload':
      return (
        <>
          <path d="M7 16.5a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 19 11.5" />
          <path d="M12 20.5v-8M9.2 15.2 12 12.4l2.8 2.8" />
        </>
      )
    case 'info':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 11v5.5" />
          <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
        </>
      )
    case 'theme':
      return (
        <>
          <path d="M12 4.5c-3.2 0-5.2 2-5.2 4.6 0 1.4.6 2.5 1.5 3.3l-.6 5.1h8.6l-.6-5.1c.9-.8 1.5-1.9 1.5-3.3 0-2.6-2-4.6-5.2-4.6z" />
          <circle cx="9.4" cy="8.4" r="0.85" fill="currentColor" stroke="none" />
          <circle cx="12" cy="7.2" r="0.85" fill="currentColor" stroke="none" />
          <circle cx="14.6" cy="8.4" r="0.85" fill="currentColor" stroke="none" />
          <circle cx="13.4" cy="10.4" r="0.85" fill="currentColor" stroke="none" />
        </>
      )
    case 'share':
      return (
        <>
          <circle cx="6.5" cy="12" r="2.2" />
          <circle cx="17" cy="6.5" r="2.2" />
          <circle cx="17" cy="17.5" r="2.2" />
          <path d="M8.4 11.1 15.1 7.4M8.4 12.9l6.7 3.7" />
        </>
      )
    case 'warning':
      return (
        <>
          <path d="M12 4.2 20.5 19.2H3.5z" />
          <path d="M12 10v4.2" />
          <circle cx="12" cy="16.6" r="0.85" fill="currentColor" stroke="none" />
        </>
      )
    case 'success':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.2 12.2 11 15l4.8-5.5" />
        </>
      )
    case 'maintenanceDue':
      return (
        <>
          <rect x="4" y="5.5" width="12.5" height="12.5" rx="2" />
          <path d="M4 9.2h12.5M7.2 3.8v3M13.2 3.8v3" />
          <path d="M7.5 12h2.2M7.5 14.8h3.5" />
          <circle cx="17.2" cy="16.8" r="3.6" />
          <path d="M17.2 15.2v1.8l1.2.8" />
        </>
      )
    case 'licenseLocked':
      return (
        <>
          <rect x="6" y="10.5" width="12" height="9" rx="2" />
          <path d="M8.8 10.5V8.2a3.2 3.2 0 0 1 6.4 0v2.3" />
          <rect x="10.2" y="13.2" width="3.6" height="3.6" rx="0.6" />
          <path d="M12 13.8l.55.4L12 15.2l-.55-.4z" fill="currentColor" stroke="none" />
        </>
      )
    default:
      return null
  }
}

export function Icon({ name, className, size = 20, title }: IconProps): React.JSX.Element {
  return (
    <Svg className={className} size={size} title={title}>
      {paths(name)}
    </Svg>
  )
}
