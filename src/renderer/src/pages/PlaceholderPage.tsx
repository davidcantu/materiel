type PlaceholderPageProps = {
  title: string
  blurb: string
}

export function PlaceholderPage({ title, blurb }: PlaceholderPageProps): React.JSX.Element {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{blurb}</p>
        </div>
      </header>
      <section className="placeholder">
        <h2>Coming soon</h2>
        <p>This module lands in a follow-up PR.</p>
      </section>
    </div>
  )
}
