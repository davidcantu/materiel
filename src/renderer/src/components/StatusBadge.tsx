import type { PartStatus } from '../../../shared/parts'

const STATUS_CLASS: Record<PartStatus, string> = {
  'In Stock': 'status-in-stock',
  'In Use': 'status-in-use',
  Retired: 'status-retired',
  Sold: 'status-sold'
}

export function StatusBadge({ status }: { status: PartStatus }): React.JSX.Element {
  return <span className={`status-badge ${STATUS_CLASS[status]}`}>{status}</span>
}
