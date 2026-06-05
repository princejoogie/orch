export type SessionStatus = "working" | "completed"

export type SessionHistoryMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  queued?: boolean | undefined
  permissionRequested?: boolean | undefined
}

export type SessionPermissionRequest = {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  summary: string
  tool?:
    | {
        messageID: string
        callID: string
      }
    | undefined
}

export type SessionModel = {
  providerID: string
  modelID: string
  variant?: string | undefined
}

export type SessionRow = {
  id: string
  title: string
  latestMessage: string
  latestUserMessage: string
  messages: SessionHistoryMessage[]
  hasMoreMessages: boolean
  pendingPermissionRequests: SessionPermissionRequest[]
  contextTokens?: number | undefined
  contextPercent?: number | undefined
  directory: string
  projectID: string
  projectTitle: string
  worktreeName: string
  workspaceID?: string | undefined
  model?: SessionModel | undefined
  updated: number
  status: SessionStatus
}

export type WorktreeRow = {
  directory: string
  name: string
  primary?: boolean | undefined
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
