import { describe, expect, test } from "bun:test"
import { normalizeOrchConfig, normalizeServerUrl } from "../src/config/orch.ts"

describe("orch config", () => {
  test("normalizes server urls and preserves active server", () => {
    const config = normalizeOrchConfig({
      activeServerUrl: "http://localhost:4096/",
      servers: [
        { name: "local", url: "http://localhost:4096/" },
        { name: "duplicate", url: "http://localhost:4096" },
      ],
    })

    expect(config.activeServerUrl).toBe("http://localhost:4096")
    expect(config.servers).toEqual([{ name: "local", url: "http://localhost:4096" }])
  })

  test("adds active server when missing from server list", () => {
    const config = normalizeOrchConfig({ activeServerUrl: "http://remote:4096", servers: [] })

    expect(config.activeServerUrl).toBe("http://remote:4096")
    expect(config.servers[0]).toEqual({ name: "remote:4096", url: "http://remote:4096" })
  })

  test("trims trailing slash", () => {
    expect(normalizeServerUrl("http://localhost:4096/")).toBe("http://localhost:4096")
  })
})
