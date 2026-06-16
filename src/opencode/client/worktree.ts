import { Effect } from "effect"
import { opencodeCall, opencodeClient, requestOptions } from "./base.ts"

export function createWorktree(input: {
  directory: string
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}) {
  return Effect.gen(function* () {
    const worktree = yield* opencodeCall("worktree.create", (signal) =>
      opencodeClient(input.serverUrl).worktree.create(
        { directory: input.directory, ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}) },
        requestOptions(undefined, signal),
      ),
    )

    return { directory: worktree.data.directory, name: worktree.data.name }
  })
}

export function removeWorktree(input: {
  projectDirectory: string
  worktreeDirectory: string
  workspaceID?: string | undefined
  serverUrl?: string | undefined
}) {
  return opencodeCall("worktree.remove", (signal) =>
    opencodeClient(input.serverUrl).worktree.remove(
      {
        directory: input.projectDirectory,
        ...(input.workspaceID !== undefined ? { workspace: input.workspaceID } : {}),
        worktreeRemoveInput: { directory: input.worktreeDirectory },
      },
      requestOptions(undefined, signal),
    ),
  ).pipe(Effect.asVoid)
}
