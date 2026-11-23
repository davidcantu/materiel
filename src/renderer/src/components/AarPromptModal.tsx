import type { SessionType } from '../../../shared/shooting-logs'
import {
  AAR_PROMPT_BODY_MATCH,
  AAR_PROMPT_BODY_PRACTICE,
  AAR_PROMPT_LATER,
  AAR_PROMPT_TITLE,
  AAR_PROMPT_YES
} from '../../../shared/aar-template'
import { Modal } from './Modal'

type AarPromptModalProps = {
  sessionType: SessionType
  onYes: () => void
  onLater: () => void
}

export function AarPromptModal({
  sessionType,
  onYes,
  onLater
}: AarPromptModalProps): React.JSX.Element {
  return (
    <Modal title={AAR_PROMPT_TITLE} onClose={onLater} wide={false}>
      <p>
        {sessionType === 'Match' ? AAR_PROMPT_BODY_MATCH : AAR_PROMPT_BODY_PRACTICE}
      </p>
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onLater}>
          {AAR_PROMPT_LATER}
        </button>
        <button type="button" className="btn-primary" onClick={onYes}>
          {AAR_PROMPT_YES}
        </button>
      </div>
    </Modal>
  )
}
