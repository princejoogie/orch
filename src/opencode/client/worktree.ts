import { opencodeClient } from "./base.ts"

export async function createWorktree(input: {
  directory: string
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}): Promise<{ directory: string; name: string }> {
  const worktree = await opencodeClient(input.serverUrl).worktree.create(
    { directory: input.directory, ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}) },
    { throwOnError: true },
  )

  return { directory: worktree.data.directory, name: worktree.data.name }
}

export async function removeWorktree(input: {
  projectDirectory: string
  worktreeDirectory: string
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}): Promise<void> {
  await opencodeClient(input.serverUrl).worktree.remove(
    {
      directory: input.projectDirectory,
      ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}),
      worktreeRemoveInput: { directory: input.worktreeDirectory },
    },
    { throwOnError: true },
  )
}
