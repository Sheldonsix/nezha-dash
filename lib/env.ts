/**
 * Server-side environment variables
 */
export interface ServerEnvConfig {
  /** Nezha API base URL */
  NezhaBaseUrl: string
  /** Nezha API authentication token */
  NezhaAuth: string
  /** Default locale for the application */
  DefaultLocale: string
  /** Force show all servers */
  ForceShowAllServers: boolean
  /** Site password */
  SitePassword: string
  /** Enable packet loss calculation */
  EnablePacketLossCalculation: boolean
  /** Komari API base URL */
  KomariBaseUrl: string
  /** MyNodeQuery API base URL */
  MyNodeQueryBaseUrl: string
  /** NodeStatus API base URL */
  NodeStatusBaseUrl: string
  /** NodeStatus-Go admin username */
  NodeStatusWebUsername: string
  /** NodeStatus-Go admin password */
  NodeStatusWebPassword: string
}

/**
 * Client-side environment variables (NEXT_PUBLIC_*)
 */
export interface ClientEnvConfig {
  /** Nezha data fetch interval in milliseconds */
  NezhaFetchInterval: number
  /** Show country flags */
  ShowFlag: boolean
  /** Disable cartoon effects */
  DisableCartoon: boolean
  /** Show server tags */
  ShowTag: boolean
  /** Show network transfer information */
  ShowNetTransfer: boolean
  /** Force use SVG flags */
  ForceUseSvgFlag: boolean
  /** Fix server names at the top */
  FixedTopServerName: boolean
  /** Custom logo URL */
  CustomLogo: string
  /** Custom site title */
  CustomTitle: string
  /** Custom site description */
  CustomDescription: string
  /** Custom navigation links */
  Links: string
  /** Disable search engine indexing */
  DisableIndex: boolean
  /** Show tag count */
  ShowTagCount: boolean
  /** Show IP information */
  ShowIpInfo: boolean
  /** Enable Komari panel compatibility */
  Komari: boolean
  /** Enable MyNodeQuery panel compatibility */
  MyNodeQuery: boolean
  /** Enable NodeStatus panel compatibility */
  NodeStatus: boolean
  /** Show server detail summary */
  ShowServerDetailSummary: boolean
}

const clientEnvDefaults: Partial<Record<keyof ClientEnvConfig, string | undefined>> = {
  NezhaFetchInterval: process.env.NEXT_PUBLIC_NezhaFetchInterval,
  ShowFlag: process.env.NEXT_PUBLIC_ShowFlag,
  DisableCartoon: process.env.NEXT_PUBLIC_DisableCartoon,
  ShowTag: process.env.NEXT_PUBLIC_ShowTag,
  ShowNetTransfer: process.env.NEXT_PUBLIC_ShowNetTransfer,
  ForceUseSvgFlag: process.env.NEXT_PUBLIC_ForceUseSvgFlag,
  FixedTopServerName: process.env.NEXT_PUBLIC_FixedTopServerName,
  CustomLogo: process.env.NEXT_PUBLIC_CustomLogo,
  CustomTitle: process.env.NEXT_PUBLIC_CustomTitle,
  CustomDescription: process.env.NEXT_PUBLIC_CustomDescription,
  Links: process.env.NEXT_PUBLIC_Links,
  DisableIndex: process.env.NEXT_PUBLIC_DisableIndex,
  ShowTagCount: process.env.NEXT_PUBLIC_ShowTagCount,
  ShowIpInfo: process.env.NEXT_PUBLIC_ShowIpInfo,
  Komari: process.env.NEXT_PUBLIC_Komari,
  MyNodeQuery: process.env.NEXT_PUBLIC_MyNodeQuery,
  NodeStatus: process.env.NEXT_PUBLIC_NodeStatus,
  ShowServerDetailSummary: process.env.NEXT_PUBLIC_ShowServerDetailSummary,
}

/**
 * 环境变量键的类型定义
 */
export type EnvKey = ServerEnvKey | ClientEnvKey

/**
 * 服务器端环境变量键
 */
export type ServerEnvKey = keyof ServerEnvConfig

/**
 * 客户端环境变量键
 */
export type ClientEnvKey = `NEXT_PUBLIC_${keyof ClientEnvConfig}`

/**
 * Get a server-side environment variable
 * @param key - Environment variable key
 * @returns Environment variable value
 */
export function getServerEnv<K extends keyof ServerEnvConfig>(key: K): string | undefined {
  const value = process.env[key]
  if (!value) {
    return undefined
  }
  return value
}

/**
 * Get a client-side environment variable
 * @param key - Environment variable key
 * @returns Environment variable value
 */
export function getClientEnv<K extends keyof ClientEnvConfig>(key: K): string | undefined {
  const value =
    typeof window === "undefined" ? process.env[`NEXT_PUBLIC_${key}`] : clientEnvDefaults[key]
  if (!value) {
    return undefined
  }
  return value
}

/**
 * Parse boolean environment variable
 * @param value - Environment variable value
 * @returns Parsed boolean value
 */
export function parseBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === "true"
}

/**
 * Parse number environment variable
 * @param value - Environment variable value
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed number value
 */
export function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

/**
 * Get all environment variables with their current values
 */
export function getAllEnvConfig(): { server: ServerEnvConfig; client: ClientEnvConfig } {
  return {
    server: {
      NezhaBaseUrl: getServerEnv("NezhaBaseUrl") || "",
      NezhaAuth: getServerEnv("NezhaAuth") || "",
      DefaultLocale: getServerEnv("DefaultLocale") || "",
      ForceShowAllServers: parseBoolean(getServerEnv("ForceShowAllServers")),
      SitePassword: getServerEnv("SitePassword") || "",
      EnablePacketLossCalculation: parseBoolean(getServerEnv("EnablePacketLossCalculation")),
      KomariBaseUrl: getServerEnv("KomariBaseUrl") || "",
      MyNodeQueryBaseUrl: getServerEnv("MyNodeQueryBaseUrl") || "",
      NodeStatusBaseUrl: getServerEnv("NodeStatusBaseUrl") || "",
      NodeStatusWebUsername: getServerEnv("NodeStatusWebUsername") || "",
      NodeStatusWebPassword: getServerEnv("NodeStatusWebPassword") || "",
    },
    client: {
      NezhaFetchInterval: parseNumber(getClientEnv("NezhaFetchInterval"), 5000),
      ShowFlag: parseBoolean(getClientEnv("ShowFlag")),
      DisableCartoon: parseBoolean(getClientEnv("DisableCartoon")),
      ShowTag: parseBoolean(getClientEnv("ShowTag")),
      ShowNetTransfer: parseBoolean(getClientEnv("ShowNetTransfer")),
      ForceUseSvgFlag: parseBoolean(getClientEnv("ForceUseSvgFlag")),
      FixedTopServerName: parseBoolean(getClientEnv("FixedTopServerName")),
      CustomLogo: getClientEnv("CustomLogo") || "",
      CustomTitle: getClientEnv("CustomTitle") || "",
      CustomDescription: getClientEnv("CustomDescription") || "",
      Links: getClientEnv("Links") || "",
      DisableIndex: parseBoolean(getClientEnv("DisableIndex")),
      ShowTagCount: parseBoolean(getClientEnv("ShowTagCount")),
      ShowIpInfo: parseBoolean(getClientEnv("ShowIpInfo")),
      Komari: parseBoolean(getClientEnv("Komari")),
      MyNodeQuery: parseBoolean(getClientEnv("MyNodeQuery")),
      NodeStatus: parseBoolean(getClientEnv("NodeStatus")),
      ShowServerDetailSummary: parseBoolean(getClientEnv("ShowServerDetailSummary")),
    },
  }
}
