/** Keep the original engine's transactions; extend its summarization hook. */
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { summarizeWithLlm, type SummarizationInput, type SummaryResult } from './summarizer.ts'
import { resolveTargetPolicy } from './config.ts'
export type { SummarizationInput, SummaryResult } from './summarizer.ts'
export interface BasicSummaryRequest { input: SummarizationInput; readonly agent: Agent; signal: AbortSignal | undefined }
declare module '@deepseek-ai/cordis' {
  interface Events {
    'compaction/basic-summary'(request: BasicSummaryRequest, next: () => Promise<SummaryResult>): Promise<SummaryResult>
  }
}
export default class NotebookCompactionEngine extends BasicCompactionEngine {
  protected override async summarize(input: SummarizationInput, agent: Agent, signal?: AbortSignal): Promise<SummaryResult> {
    const routed = agent.session.requestHeader()?.config
    const provider = routed?.provider || agent.options.provider, model = routed?.model || agent.options.model
    const config = provider && model ? resolveTargetPolicy(this.config, { provider, model }) : this.config
    const request: BasicSummaryRequest = { input, agent, signal }
    return this.ctx.waterfall('compaction/basic-summary', request,
      () => summarizeWithLlm(this.ctx, config, request.input, agent, request.signal))
  }
}
