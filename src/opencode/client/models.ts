import type { Agent, Provider } from "@opencode-ai/sdk/v2"
import { Effect } from "effect"
import { opencodeCall, opencodeClient, requestOptions, routeOptions } from "./base.ts"

export type ModelOption = {
  providerID: string
  providerName: string
  modelID: string
  name: string
  variants: string[]
}

export type ModelProviderOption = {
  id: string
  name: string
  models: ModelOption[]
}

export type DefaultModelOption = {
  providerID: string
  modelID: string
  variant?: string | undefined
}

export function loadDefaultModel(input: {
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}) {
  const client = opencodeClient(input.serverUrl)
  return Effect.gen(function* () {
    const [config, agents] = yield* Effect.all(
      [
        opencodeCall("config.get", (signal) => client.config.get(routeOptions(input), requestOptions(input, signal))),
        opencodeCall("app.agents", (signal) => client.app.agents(routeOptions(input), requestOptions(input, signal))),
      ],
      { concurrency: 2 },
    )
    return defaultAgentModel(config.data.default_agent, agents.data) ?? parseModelConfig(config.data.model)
  })
}

export function loadModelProviders(input: {
  directory?: string | undefined
  workspaceID?: string | undefined
  serverUrl?: string | undefined
  signal?: AbortSignal | undefined
}) {
  return Effect.gen(function* () {
    const result = yield* opencodeCall("config.providers", (signal) =>
      opencodeClient(input.serverUrl).config.providers(routeOptions(input), requestOptions(input, signal)),
    )

    return result.data.providers
      .map((provider: Provider) => {
        const providerName = provider.name ?? provider.id
        return {
          id: provider.id,
          name: providerName,
          models: Object.entries(provider.models).map(([modelID, model]) => ({
            providerID: provider.id,
            providerName,
            modelID,
            name: model.name ?? modelID,
            variants: Object.keys(model.variants ?? {}),
          })),
        }
      })
      .filter((provider) => provider.models.length > 0)
  })
}

function parseModelConfig(value: string | undefined): DefaultModelOption | undefined {
  if (!value) return undefined

  const separatorIndex = value.indexOf("/")
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return undefined

  return {
    providerID: value.slice(0, separatorIndex),
    modelID: value.slice(separatorIndex + 1),
  }
}

function defaultAgentModel(defaultAgentName: string | undefined, agents: Agent[]): DefaultModelOption | undefined {
  const configuredAgent = defaultAgentName ? agents.find((agent) => agent.name === defaultAgentName) : undefined
  const fallbackAgent = agents.find((agent) => agent.name === "build")
  const agent = configuredAgent ?? fallbackAgent
  const model = agent?.model
  if (!model) return undefined

  return {
    providerID: model.providerID,
    modelID: model.modelID,
    ...(agent.variant !== undefined ? { variant: agent.variant } : {}),
  }
}
