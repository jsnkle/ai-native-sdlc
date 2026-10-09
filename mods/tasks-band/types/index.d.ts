export type Tasks = { done: number; total: number; next: string | null }

declare module 'claude-code' {
  interface PluginState {
    'tasks-band': { tasks: Tasks | null }
  }
}
