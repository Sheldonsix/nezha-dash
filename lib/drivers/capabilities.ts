import getEnv from "@/lib/env-entry"

export function configuredDriverSupportsMonitoring(): boolean {
  return !(
    getEnv("NEXT_PUBLIC_Komari") === "true" ||
    getEnv("NEXT_PUBLIC_MyNodeQuery") === "true" ||
    getEnv("NEXT_PUBLIC_NodeStatus") === "true"
  )
}
