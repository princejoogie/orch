export type SessionStatus = "working" | "completed"

export type SessionRow = {
  id: string
  title: string
  latestMessage: string
  latestUserMessage: string
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

export type DashboardSnapshot = {
  rows: SessionRow[]
  serverUrl: string
  since: number
  scannedAt: Date
}
