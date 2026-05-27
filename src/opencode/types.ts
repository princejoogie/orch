export type SessionStatus = "working" | "completed"

export type SessionRow = {
  id: string
  title: string
  latestMessage: string
  directory: string
  projectID: string
  projectTitle: string
  worktreeName: string
  workspaceID?: string
  updated: number
  status: SessionStatus
}

export type DashboardSnapshot = {
  rows: SessionRow[]
  serverUrl: string
  since: number
  scannedAt: Date
}
