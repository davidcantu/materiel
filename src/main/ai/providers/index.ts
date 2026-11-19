import type { AiProviderId } from '../../../shared/ai'
import { AI_PROVIDER_LABELS } from '../../../shared/ai'
import { createAnthropicProvider } from './anthropic'
import { createOpenAiCompatibleProvider, OPENAI_COMPATIBLE_CONFIGS } from './openai-compatible'
import type { LLMProvider, ProviderFactoryOptions } from './types'

export type { LLMProvider, ProviderFactoryOptions, FetchImpl } from './types'
export { createAnthropicProvider } from './anthropic'
export { createOpenAiCompatibleProvider, OPENAI_COMPATIBLE_CONFIGS } from './openai-compatible'

export function createLLMProvider(
  providerId: AiProviderId,
  options: ProviderFactoryOptions
): LLMProvider {
  if (providerId === 'anthropic') {
    return createAnthropicProvider(options)
  }
  const config = OPENAI_COMPATIBLE_CONFIGS[providerId]
  return createOpenAiCompatibleProvider(config, options)
}

export function providerLabel(providerId: AiProviderId): string {
  return AI_PROVIDER_LABELS[providerId]
}
