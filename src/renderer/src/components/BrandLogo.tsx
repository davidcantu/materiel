import logoDark from '../assets/brand/materiel-logo-horizontal-dark-transparent.png'
import logoLight from '../assets/brand/materiel-logo-horizontal-light-transparent.png'

type BrandLogoProps = {
  className?: string
  /** Accessible name; omit when a visible “Materiel” heading is adjacent */
  alt?: string
}

/**
 * Theme-swapped horizontal lockup (B1). Uses CSS against html[data-theme]
 * so System / Light / Dark stay in sync without extra JS.
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
