import logoDark from '../assets/brand/materiel-logo-horizontal-dark.png'
import logoLight from '../assets/brand/materiel-logo-horizontal-light.png'

type BrandLogoProps = {
  className?: string
  /** Accessible name; omit when a visible “Materiel” heading is adjacent */
  alt?: string
}

/**
 * Theme-swapped B1 horizontal lockup (heavy geometric M + stencil wordmark).
 * Light/dark PNGs derive from locked materiel-logo-b-bold-v1; swap via html[data-theme].
 */
export function BrandLogo({ className = '', alt = 'Materiel' }: BrandLogoProps): React.JSX.Element {
  const classes = `brand-logo${className ? ` ${className}` : ''}`
  return (
    <span className={classes}>
      <img
        className="brand-logo-img brand-logo-light"
        src={logoLight}
        alt={alt}
        draggable={false}
      />
      <img
        className="brand-logo-img brand-logo-dark"
        src={logoDark}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    </span>
  )
}
