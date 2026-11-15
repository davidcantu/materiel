import { PageHeader } from '../components/PageHeader'

type PlaceholderPageProps = {
  title: string
  blurb: string
}

export function PlaceholderPage({ title, blurb }: PlaceholderPageProps): React.JSX.Element {
  return (
    <div className="page">
      <PageHeader title={title} description={blurb} />
      <section className="placeholder">
        <h2>Coming soon</h2>
        <p>This module lands in a follow-up PR.</p>
      </section>
    </div>
  )
}
