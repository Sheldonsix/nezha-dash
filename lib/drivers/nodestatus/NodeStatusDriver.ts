/**
 * NodeStatus monitoring system driver implementation
 */

import { connection } from "next/server"
import { BaseDriver } from "../base"
import type {
  DriverConfig,
  NezhaAPI,
  NezhaAPIMonitor,
  NodeStatusAPIResponse,
  NodeStatusServer,
  ServerApi,
} from "../types"
import { DriverOperationError } from "../types"

const KIB = 1024
const MIB = 1024 * 1024

export class NodeStatusDriver extends BaseDriver {
  constructor() {
    super("nodestatus", {
      supportsMonitoring: false,
      supportsRealTimeData: true,
      supportsHistoricalData: false,
      supportsIpInfo: false,
      supportsPacketLoss: false,
      supportsAlerts: false,
    })
  }

  protected async onInitialize(_config: DriverConfig): Promise<void> {
    try {
      await this.validateApi()
    } catch (error) {
      throw new DriverOperationError(
        this.name,
        "initialize",
        `Failed to connect to NodeStatus API: ${error}`,
      )
    }
  }

  async getServers(): Promise<ServerApi> {
    await connection()
    this.ensureInitialized()

    const status = await this.fetchStatus()
    return this.convertStatusToServerApi(status)
  }

  async getServerDetail(serverId: number): Promise<NezhaAPI> {
    await connection()
    this.ensureInitialized()

    const data = await this.getServers()
    const server = data.result.find((item) => item.id === serverId)

    if (!server) {
      throw new DriverOperationError(
        this.name,
        "getServerDetail",
        `Server with ID ${serverId} not found`,
      )
    }

    return {
      ...server,
      ipv4: "",
      ipv6: "",
      valid_ip: "",
    }
  }

  protected async onGetServerMonitor(_serverId: number): Promise<NezhaAPIMonitor[]> {
    console.warn("Latency monitor data not available in NodeStatus mode")
    return []
  }

  protected async onGetServerIP(_serverId: number): Promise<string> {
    console.warn("IP information not available in NodeStatus mode")
    return ""
  }

  protected async onHealthCheck(): Promise<void> {
    this.ensureInitialized()
    await this.fetchStatus()
  }

  private async fetchStatus(): Promise<NodeStatusAPIResponse> {
    const response = await fetch(`${this.config?.baseUrl}/api/status`, this.createFetchOptions())
    const data: NodeStatusAPIResponse = await this.handleFetchResponse(response)

    if (!Array.isArray(data?.servers) || !Number.isFinite(Number(data?.updated))) {
      throw new DriverOperationError(this.name, "fetchStatus", "Invalid NodeStatus response")
    }

    return data
  }

  private async validateApi(): Promise<void> {
    if (!this.config?.baseUrl) {
      throw new Error("Base URL is not configured")
    }

    const response = await fetch(`${this.config.baseUrl}/api/status`, {
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    if (!Array.isArray(data?.servers) || !Number.isFinite(Number(data?.updated))) {
      throw new Error("Invalid API response")
    }
  }

  private convertStatusToServerApi(status: NodeStatusAPIResponse): ServerApi {
    const data: ServerApi = {
      live_servers: 0,
      offline_servers: 0,
      total_out_bandwidth: 0,
      total_in_bandwidth: 0,
      total_in_speed: 0,
      total_out_speed: 0,
      result: [],
    }

    const updated = this.toNumber(status.updated)
    const servers = status.servers.map((server) => this.convertNodeStatusToNezha(server, updated))

    for (const server of servers) {
      if (server.online_status) {
        data.live_servers += 1
        data.total_out_bandwidth += server.status.NetOutTransfer
        data.total_in_bandwidth += server.status.NetInTransfer
        data.total_in_speed += server.status.NetInSpeed
        data.total_out_speed += server.status.NetOutSpeed
      } else {
        data.offline_servers += 1
      }
    }

    data.result = servers
    return data
  }

  private convertNodeStatusToNezha(server: NodeStatusServer, updated: number): NezhaAPI {
    const status = server.status || {}
    const online = Boolean(status.online4 || status.online6)
    const uptime = online ? this.toNumber(status.uptime) : 0

    return {
      id: this.toNumber(server.id) || this.generateNumericId(server.username || server.name),
      name: server.name || server.username,
      tag: server.type || "",
      last_active: this.toNumber(server.last_active) || (online ? updated : 0),
      online_status: online,
      ipv4: "",
      ipv6: "",
      valid_ip: "",
      display_index: this.toNumber(server.order),
      hide_for_guest: false,
      host: {
        Platform: status.platform || "",
        PlatformVersion: status.platform_version || "",
        CPU: status.cpu_info || [],
        MemTotal: this.toNumber(status.memory_total) * KIB,
        DiskTotal: this.toNumber(status.hdd_total) * MIB,
        SwapTotal: this.toNumber(status.swap_total) * KIB,
        Arch: status.arch || "",
        Virtualization: status.virtualization || server.type || "",
        BootTime: uptime > 0 && updated > 0 ? Math.max(0, updated - uptime) : 0,
        CountryCode: server.region || "",
        Version: status.version || "",
        GPU: status.gpu_info || [],
      },
      status: {
        CPU: this.clampPercentage(status.cpu),
        MemUsed: this.toNumber(status.memory_used) * KIB,
        SwapUsed: this.toNumber(status.swap_used) * KIB,
        DiskUsed: this.toNumber(status.hdd_used) * MIB,
        NetInTransfer: this.toNumber(status.network_rx),
        NetOutTransfer: this.toNumber(status.network_tx),
        NetInSpeed: this.toNumber(status.network_in),
        NetOutSpeed: this.toNumber(status.network_out),
        Uptime: uptime,
        Load1: this.toNumber(status.load1 ?? status.load),
        Load5: this.toNumber(status.load5 ?? status.load),
        Load15: this.toNumber(status.load15 ?? status.load),
        TcpConnCount: this.toNumber(status.tcp_conn_count),
        UdpConnCount: this.toNumber(status.udp_conn_count),
        ProcessCount: this.toNumber(status.process_count),
        Temperatures: this.toNumber(status.temperatures),
        GPU: this.clampPercentage(status.gpu),
      },
    }
  }

  private toNumber(value: unknown): number {
    const numberValue = typeof value === "number" ? value : Number(value)
    return Number.isFinite(numberValue) ? numberValue : 0
  }

  private clampPercentage(value: unknown): number {
    const numberValue = this.toNumber(value)
    return Math.min(100, Math.max(0, numberValue))
  }

  private generateNumericId(value: string): number {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }
}
