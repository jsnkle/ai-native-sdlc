/**
 * `pending` until the Bash call is under way (its permission prompt may still
 * be open): a job gets no verdict while pending.
 */
export type CodexJobStatus = 'pending' | 'running' | 'done' | 'failed'

export type CodexJob = {
  /** The Bash call's tool_use_id. */
  id: string
  command: string
  model?: string
  /** The `-o` path as written in the command. */
  reportPath?: string
  /** The `-o` path resolved against the directory the command runs in. */
  reportFile?: string
  /** The directory Codex runs in: `-C`, else a leading `cd`, else the session's. */
  codexCwd: string
  /** The id after `codex exec resume`. */
  resumeId?: string
  /** `codex exec resume --last`. */
  isResumeLast?: boolean
  /** The call asked for `run_in_background`, or the tool moved it there. */
  isBackground: boolean
  startedAt: number
  endedAt?: number
  /** What settled it: a turn event, a quiet file with no process, or the Bash call returning. */
  endedBy?: 'rollout' | 'quiet' | 'bash'
  status: CodexJobStatus
  /** Why a job counts as failed, in a few words. */
  reason?: string
  /** The Codex session id, from the rollout file's name. */
  sessionId?: string
  rolloutPath?: string
  /** `total_token_usage.total_tokens` of the last `token_count`: cumulative over the session's turns. */
  totalTokens?: number
  /** `last_token_usage.total_tokens` of the last `token_count`: how full the context is. */
  contextTokens?: number
  /** `model_context_window` of the last `token_count`. */
  contextWindow?: number
}

declare module 'claude-code' {
  interface PluginState {
    'codex-job-board': {
      jobs: CodexJob[]
      /** The pane has been opened once, unasked, when a job finished. */
      hasAutoOpened: boolean
    }
  }
}
