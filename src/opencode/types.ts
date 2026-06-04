export type SessionStatus = "working" | "completed"

export type SessionHistoryMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

export type SessionRow = {
  id: string
  title: string
  latestMessage: string
  latestUserMessage: string
  messages: SessionHistoryMessage[]
  hasMoreMessages: boolean
  contextTokens?: number | undefined
  contextPercent?: number | undefined
  directory: string
  projectID: string
  projectTitle: string
  worktreeName: string
  workspaceID?: string | undefined
  updated: number
  status: SessionStatus
}

export type WorktreeRow = {
  directory: string
  name: string
}

export type ProjectRow = {
  id: string
  title: string
  directory: string
  worktreeName: string
  worktrees: WorktreeRow[]
  updated: number
}

export type DashboardSnapshot = {
  rows: SessionRow[]
  serverUrl: string
  scannedAt: Date
}

export type ProjectSnapshot = {
  projects: ProjectRow[]
  serverUrl: string
  scannedAt: Date
}
