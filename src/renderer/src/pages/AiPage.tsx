import { useState } from 'react'
import {
  AI_ASSISTANT_SAMPLE_PROMPTS,
  type AiAssistantAskResult,
  type AiInventorySuggestion
} from '../../../shared/ai-assistant'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/icons/Icon'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/toast-context'

type AiPageProps = {
  onNavigateSettings?: () => void
}

type ChatTurn = {
  id: string
  prompt: string
  result: AiAssistantAskResult
}

export function AiPage({ onNavigateSettings }: AiPageProps): React.JSX.Element {
  const toast = useToast()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [applyingId, setApplyingId] = useState<string | null>(null)

  async function runAsk(nextPrompt: string, mode?: 'general' | 'inventory'): Promise<void> {
    const trimmed = nextPrompt.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setPrompt(trimmed)
    try {
      const result = await window.api.askAiAssistant({ prompt: trimmed, mode })
      setTurns((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          prompt: trimmed,
          result
        }
      ])
      if (!result.ok) {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setBusy(false)
    }
  }

  async function applySuggestion(suggestion: AiInventorySuggestion): Promise<void> {
    const key = `${suggestion.partId}:${suggestion.field}`
    setApplyingId(key)
    try {
      const result = await window.api.applyAiInventorySuggestion({
        partId: suggestion.partId,
        field: suggestion.field,
        value: suggestion.suggestedValue
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Updated ${suggestion.label} · ${suggestion.field}`)
      setTurns((prev) =>
        prev.map((turn) => {
          if (!turn.result.ok) return turn
          return {
            ...turn,
            result: {
              ...turn.result,
              inventorySuggestions: turn.result.inventorySuggestions.filter(
                (s) => !(s.partId === suggestion.partId && s.field === suggestion.field)
              )
            }
          }
        })
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not apply suggestion')
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="AI View"
        description="Ask About Your Armory, Training Plan, And Match Gaps — Powered By Your Own API Key."
      />

      <section className="ai-prompt-panel">
        <p className="muted ai-prompt-lead">Spark a useful question, or write your own.</p>
        <div className="ai-prompt-chips" role="list">
          {AI_ASSISTANT_SAMPLE_PROMPTS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="ai-prompt-chip"
              role="listitem"
              disabled={busy}
              onClick={() =>
                void runAsk(
                  sample.prompt,
                  sample.id === 'inventory-fill' ? 'inventory' : 'general'
                )
              }
            >
              <span className="ai-prompt-chip-title">{sample.title}</span>
              <span className="ai-prompt-chip-label">{sample.label}</span>
            </button>
          ))}
        </div>

        <form
          className="ai-ask-form"
          onSubmit={(e) => {
            e.preventDefault()
            void runAsk(prompt)
          }}
        >
          <label className="field ai-ask-field">
            <span className="field-label">Your question</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Which barrel is closest to end of life, and what should I plan next?"
              disabled={busy}
            />
          </label>
          <button type="submit" className="btn-primary btn-with-icon" disabled={busy || !prompt.trim()}>
            <Icon name="ai" size={16} />
            {busy ? 'Thinking…' : 'Ask AI'}
          </button>
        </form>
      </section>

      {turns.length === 0 && !busy ? (
        <EmptyState
          icon="ai"
          title="Your armory, interrogated"
          description="Sample prompts above open with your live inventory, builds, logs, ammo, and AARs. Inventory fill can propose field updates you apply one at a time."
          actionLabel="Open Settings"
          actionIcon="settings"
          onAction={() => onNavigateSettings?.()}
        />
      ) : null}

      <div className="ai-turn-list">
        {[...turns].reverse().map((turn) => (
          <article key={turn.id} className="ai-turn">
            <h3 className="ai-turn-prompt">{turn.prompt}</h3>
            {turn.result.ok ? (
              <>
                <div className="ai-turn-answer">{renderAnswer(turn.result.answer)}</div>
                <p className="muted ai-turn-meta">Model: {turn.result.model}</p>
                {turn.result.inventorySuggestions.length > 0 ? (
                  <div className="ai-suggestion-list">
                    <h4>Suggested inventory updates</h4>
                    {turn.result.inventorySuggestions.map((suggestion) => {
                      const key = `${suggestion.partId}:${suggestion.field}`
                      return (
                        <div key={key} className="ai-suggestion">
                          <div>
                            <strong>{suggestion.label}</strong>
                            <span className="muted"> · {suggestion.field}</span>
                            <p className="ai-suggestion-values">
                              <span className="muted">
                                {suggestion.currentValue ?? 'empty'} →{' '}
                              </span>
                              {suggestion.suggestedValue}
                            </p>
                            {suggestion.reason ? (
                              <p className="muted">{suggestion.reason}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={applyingId === key}
                            onClick={() => void applySuggestion(suggestion)}
                          >
                            {applyingId === key ? 'Applying…' : 'Apply'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="error-text">{turn.result.error}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

function renderAnswer(answer: string): React.JSX.Element {
  const blocks = answer.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  return (
    <>
      {blocks.map((block, index) => {
        if (block.startsWith('- ') || block.startsWith('* ')) {
          const items = block
            .split('\n')
            .map((line) => line.replace(/^[-*]\s+/, '').trim())
            .filter(Boolean)
          return (
            <ul key={index} className="ai-answer-list">
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          )
        }
        return <p key={index}>{block}</p>
      })}
    </>
  )
}
