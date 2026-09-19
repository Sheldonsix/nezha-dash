import type { NodeStatusAPIResponse } from '@/lib/drivers/types';
import getEnv from '@/lib/env-entry';

export type NodeStatusResp<T = unknown> = {
  code: 0 | 1;
  data: T;
  msg: string;
};

export type NodeStatusAdminServer = {
  id: number;
  username: string;
  name: string;
  type: string;
  location: string;
  region: string;
  disabled: boolean;
  order: number;
};

export type NodeStatusAdminEvent = {
  id: number;
  username: string;
  resolved: boolean;
  created_at: string | number;
  updated_at: string | number;
};

export type NodeStatusEventList = {
  count: number;
  list: NodeStatusAdminEvent[];
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function baseUrl() {
  const value = getEnv('NodeStatusBaseUrl');
  if (!value) throw new Error('NodeStatusBaseUrl is required');
  return value.replace(/\/$/, '');
}

async function fetchWithRetry(input: string, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (_error) {
    try {
      return await fetch(input, init);
    } catch (error) {
      throw new Error(`${requestPath(input)} failed: ${errorMessage(error)}`);
    }
  }
}

function requestPath(input: string) {
  const url = new URL(input);
  return `${url.pathname}${url.search}`;
}

function errorMessage(error: unknown) {
  return typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message)
    : String(error);
}

async function adminToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;

  const username = getEnv('NodeStatusWebUsername');
  if (!username) throw new Error('NodeStatusWebUsername is required');
  const password = getEnv('NodeStatusWebPassword');
  if (!password) throw new Error('NodeStatusWebPassword is required');

  const res = await fetchWithRetry(`${baseUrl()}/api/admin/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
  });
  const data = (await res.json()) as NodeStatusResp<string>;
  if (!res.ok || data.code !== 0 || typeof data.data !== 'string') {
    throw new Error(data.msg || `NodeStatus login failed: ${res.status}`);
  }

  tokenCache = { token: data.data, expiresAt: Date.now() + 30 * 60 * 1000 };
  return data.data;
}

async function adminFetch<T>(
  path: string,
  init?: RequestInit,
  retry = true,
): Promise<T> {
  const token = await adminToken();
  const res = await fetchWithRetry(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (res.status === 401 && retry) {
    tokenCache = null;
    return adminFetch<T>(path, init, false);
  }

  const data = (await res.json()) as NodeStatusResp<T>;
  if (!res.ok || data.code !== 0)
    throw new Error(data.msg || `NodeStatus API failed: ${res.status}`);
  return data.data;
}

export function getNodeStatusSnapshot() {
  return fetchWithRetry(`${baseUrl()}/api/status`, { cache: 'no-store' }).then(
    async (res) => {
      if (!res.ok) throw new Error(`NodeStatus status failed: ${res.status}`);
      return (await res.json()) as NodeStatusAPIResponse;
    },
  );
}

export async function listNodeStatusAdminServers() {
  const servers = await adminFetch<NodeStatusAdminServer[] | null>(
    '/api/admin/servers',
  );
  return Array.isArray(servers) ? servers : [];
}

export function createNodeStatusAdminServer(
  input: Omit<NodeStatusAdminServer, 'id' | 'order'> & { password: string },
) {
  return adminFetch<null>('/api/admin/servers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateNodeStatusAdminServer(
  username: string,
  data: Partial<Omit<NodeStatusAdminServer, 'id' | 'order'>> & {
    password?: string;
  },
) {
  return adminFetch<null>('/api/admin/servers', {
    method: 'PUT',
    body: JSON.stringify({ username, data }),
  });
}

export function deleteNodeStatusAdminServer(username: string) {
  return adminFetch<null>(
    `/api/admin/servers/${encodeURIComponent(username)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function listNodeStatusAdminEvents(size = 10, offset = 0) {
  const events = await adminFetch<NodeStatusEventList | null>(
    `/api/admin/events?size=${size}&offset=${offset}`,
  );
  return {
    count: Number(events?.count) || 0,
    list: Array.isArray(events?.list) ? events.list : [],
  };
}

export function deleteNodeStatusAdminEvent(id: number) {
  return adminFetch<null>(`/api/admin/events/${id}`, { method: 'DELETE' });
}

export function deleteAllNodeStatusAdminEvents() {
  return adminFetch<null>('/api/admin/events', { method: 'DELETE' });
}
