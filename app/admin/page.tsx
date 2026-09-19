import { createHmac, timingSafeEqual } from 'node:crypto';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import zhLocale from 'i18n-iso-countries/langs/zh.json';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Server,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type React from 'react';
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton';
import { BackIcon } from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RegionAutoComplete } from '@/components/ui/region-autocomplete';
import getEnv from '@/lib/env-entry';
import {
  createNodeStatusAdminServer,
  deleteAllNodeStatusAdminEvents,
  deleteNodeStatusAdminEvent,
  deleteNodeStatusAdminServer,
  getNodeStatusSnapshot,
  listNodeStatusAdminEvents,
  listNodeStatusAdminServers,
  type NodeStatusAdminEvent,
  type NodeStatusAdminServer,
  updateNodeStatusAdminServer,
} from '@/lib/nodestatus-admin';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
const adminCookieName = 'nodestatus_admin';

countries.registerLocale(enLocale);
countries.registerLocale(zhLocale);

type ServerRow = NodeStatusAdminServer & {
  online: boolean | null;
  uptime?: number;
  load?: number;
  networkIn?: number;
  networkOut?: number;
};

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function adminCookieValue() {
  const username = getEnv('NodeStatusWebUsername');
  if (!username) throw new Error('NodeStatusWebUsername is required');
  const password = getEnv('NodeStatusWebPassword');
  if (!password) throw new Error('NodeStatusWebPassword is required');
  return createHmac('sha256', password)
    .update(username)
    .update('nezha-dash-admin')
    .digest('hex');
}

async function isAdminSignedIn() {
  return safeEqual(
    (await cookies()).get(adminCookieName)?.value || '',
    adminCookieValue(),
  );
}

async function requireAdmin() {
  if (!(await isAdminSignedIn())) redirect('/admin');
}

async function loginAdminAction(formData: FormData) {
  'use server';

  const username = text(formData, 'username');
  const password = text(formData, 'password');
  const expectedUsername = getEnv('NodeStatusWebUsername');
  const expectedPassword = getEnv('NodeStatusWebPassword');
  if (
    !expectedUsername ||
    !expectedPassword ||
    !safeEqual(username, expectedUsername) ||
    !safeEqual(password, expectedPassword)
  )
    redirect('/admin?error=1');
  (await cookies()).set(adminCookieName, adminCookieValue(), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/admin',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  redirect('/admin');
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

function normalizeRegion(value: string) {
  const trimmed = value.trim();
  const code =
    (/^[a-z]{2}$/i.test(trimmed) && countries.isValid(trimmed) && trimmed) ||
    (/^[a-z]{3}$/i.test(trimmed) && countries.alpha3ToAlpha2(trimmed)) ||
    countries.getAlpha2Code(trimmed, 'zh') ||
    countries.getAlpha2Code(trimmed, 'en');
  return code ? code.toUpperCase() : '';
}

async function createServerAction(formData: FormData) {
  'use server';

  await requireAdmin();
  const username = text(formData, 'username');
  const password = text(formData, 'password');
  const name = text(formData, 'name');
  const type = text(formData, 'type');
  const location = text(formData, 'location');
  const regionInput = text(formData, 'region');
  if (!username || !password || !name || !type || !location || !regionInput) {
    throw new Error('server fields are required');
  }
  const region = normalizeRegion(regionInput);
  if (!region)
    throw new Error('region must be an ISO alpha-2 code or country name');

  await createNodeStatusAdminServer({
    username,
    password,
    name,
    type,
    location,
    region,
    disabled: formData.get('disabled') === 'on',
  });
  revalidatePath('/admin');
}

async function toggleServerAction(formData: FormData) {
  'use server';

  await requireAdmin();
  const username = text(formData, 'username');
  if (!username) throw new Error('username is required');
  await updateNodeStatusAdminServer(username, {
    disabled: formData.get('disabled') === 'true',
  });
  revalidatePath('/admin');
}

async function deleteServerAction(formData: FormData) {
  'use server';

  await requireAdmin();
  const username = text(formData, 'username');
  if (!username) throw new Error('username is required');
  await deleteNodeStatusAdminServer(username);
  revalidatePath('/admin');
}

async function deleteEventAction(formData: FormData) {
  'use server';

  await requireAdmin();
  const id = Number(text(formData, 'id'));
  if (!Number.isInteger(id)) throw new Error('event id is required');
  await deleteNodeStatusAdminEvent(id);
  revalidatePath('/admin');
}

async function deleteAllEventsAction() {
  'use server';

  await requireAdmin();
  await deleteAllNodeStatusAdminEvents();
  revalidatePath('/admin');
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const missing = [
    !getEnv('NodeStatusBaseUrl') && 'NodeStatusBaseUrl',
    !getEnv('NodeStatusWebUsername') && 'NodeStatusWebUsername',
    !getEnv('NodeStatusWebPassword') && 'NodeStatusWebPassword',
  ].filter(Boolean) as string[];
  if (missing.length) return <SetupNotice missing={missing} />;

  if (!(await isAdminSignedIn())) {
    return <AdminLogin error={(await searchParams)?.error === '1'} />;
  }

  try {
    const [servers, snapshot, events] = await Promise.all([
      listNodeStatusAdminServers(),
      getNodeStatusSnapshot().catch(() => null),
      listNodeStatusAdminEvents(10, 0).catch(() => null),
    ]);
    const liveByUsername = new Map(
      (snapshot?.servers ?? []).map((server) => [server.username, server]),
    );
    const eventList = events?.list ?? [];
    const rows = (servers ?? []).map((server): ServerRow => {
      const live = liveByUsername.get(server.username);
      return {
        ...server,
        online: live
          ? Boolean(live.status?.online4 || live.status?.online6)
          : null,
        uptime: live?.status?.uptime,
        load: live?.status?.load,
        networkIn: live?.status?.network_in,
        networkOut: live?.status?.network_out,
      };
    });
    const onlineCount = snapshot
      ? rows.filter((server) => server.online).length
      : null;
    const unresolvedCount = events
      ? eventList.filter((event) => !event.resolved).length
      : null;

    return (
      <main className="mx-auto grid w-full max-w-5xl gap-4 bg-background p-4 md:gap-6 md:p-10 md:pt-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <h1 className="font-semibold text-xl">NodeStatus Admin</h1>
            <Link href={'/'}>
              <div className="flex flex-none cursor-pointer items-center gap-0.5 break-all font-semibold text-xl leading-none tracking-tight transition-opacity duration-300 hover:opacity-50">
                <BackIcon />
                {getEnv('NodeStatusWebUsername') || 'admin'}
              </div>
            </Link>
          </div>
          {getEnv('NEXT_PUBLIC_NodeStatus') !== 'true' && (
            <Badge variant="outline" className="w-fit">
              主面板未启用 NodeStatus 模式
            </Badge>
          )}
          {!snapshot && (
            <Badge variant="secondary" className="w-fit">
              状态快照暂不可用
            </Badge>
          )}
        </header>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Server className="size-4" />}
            label="节点总数"
            value={rows.length}
          />
          <StatCard
            icon={<Wifi className="size-4" />}
            label="在线"
            value={onlineCount ?? '-'}
          />
          <StatCard
            icon={<WifiOff className="size-4" />}
            label="离线"
            value={onlineCount === null ? '-' : rows.length - onlineCount}
          />
          <StatCard
            icon={<AlertTriangle className="size-4" />}
            label="未恢复故障"
            value={unresolvedCount ?? '-'}
          />
        </section>

        <Card>
          <details>
            <summary className="cursor-pointer select-none p-6 font-semibold text-base leading-none tracking-tight">
              新增节点
            </summary>
            <CardContent>
              <form
                action={createServerAction}
                className="grid gap-3 md:grid-cols-3"
              >
                <Input name="username" placeholder="用户名" required />
                <Input
                  name="password"
                  placeholder="密码"
                  required
                  type="password"
                />
                <Input name="name" placeholder="名称" required />
                <Input name="type" placeholder="类型，例如 kvm" required />
                <Input
                  name="location"
                  placeholder="位置，例如 Tokyo"
                  required
                />
                <RegionAutoComplete name="region" required />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="disabled"
                    type="checkbox"
                    className="size-4 rounded border"
                  />
                  禁用
                </label>
                <Button
                  type="submit"
                  className="gap-2 w-1/2 justify-self-end md:col-start-3"
                >
                  <Plus className="size-4" />
                  创建
                </Button>
              </form>
            </CardContent>
          </details>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">节点管理</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <Th>节点</Th>
                  <Th>状态</Th>
                  <Th>地区</Th>
                  <Th>类型</Th>
                  <Th>负载</Th>
                  <Th>在线</Th>
                  <Th className="text-right">操作</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((server) => (
                  <tr key={server.id} className="border-b last:border-0">
                    <Td>
                      <div className="flex items-center gap-3">
                        {server.region && (
                          <span
                            className={cn(
                              'fi',
                              `fi-${server.region.toLowerCase()}`,
                            )}
                          />
                        )}
                        <div>
                          <div className="font-medium">
                            {server.name || server.username}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge online={server.online} />
                        {server.disabled && (
                          <Badge variant="secondary">已禁用</Badge>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div>{server.location || '-'}</div>
                    </Td>
                    <Td>
                      <div>{server.type || '-'}</div>
                    </Td>
                    <Td>
                      <div>{server.load?.toFixed(2) ?? '-'}</div>
                    </Td>
                    <Td>{server.online ? formatUptime(server.uptime) : '-'}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <form action={toggleServerAction}>
                          <input
                            type="hidden"
                            name="username"
                            value={server.username}
                          />
                          <input
                            type="hidden"
                            name="disabled"
                            value={server.disabled ? 'false' : 'true'}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {server.disabled ? '启用' : '禁用'}
                          </Button>
                        </form>
                        <form action={deleteServerAction}>
                          <input
                            type="hidden"
                            name="username"
                            value={server.username}
                          />
                          <ConfirmSubmitButton
                            type="submit"
                            variant="destructive"
                            size="sm"
                            className="gap-2"
                            message={`确认删除 ${server.name || server.username}?`}
                          >
                            <Trash2 className="size-4" />
                            删除
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">故障记录</CardTitle>
              {events && (
                <form action={deleteAllEventsAction}>
                  <ConfirmSubmitButton
                    type="submit"
                    variant="outline"
                    size="sm"
                    message="确认清空所有故障记录?"
                  >
                    清空
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <Th>节点</Th>
                  <Th>状态</Th>
                  <Th>创建时间</Th>
                  <Th>恢复时间</Th>
                  <Th className="text-right">操作</Th>
                </tr>
              </thead>
              <tbody>
                {eventList.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
                {events && !eventList.length && (
                  <tr>
                    <Td
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      暂无故障记录
                    </Td>
                  </tr>
                )}
                {!events && (
                  <tr>
                    <Td
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      故障记录暂不可用
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    );
  } catch (error) {
    return (
      <ErrorNotice
        message={error instanceof Error ? error.message : 'Unknown error'}
      />
    );
  }
}

function AdminLogin({ error }: { error: boolean }) {
  const t = useTranslations('AdminSignIn');
  return (
    <form
      action={loginAdminAction}
      className="flex flex-1 flex-col items-center justify-center gap-4 p-4"
    >
      <section className="grid w-full max-w-sm grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
        <label htmlFor="admin-username" className="font-semibold text-base">
          {t('UsernameSignInMessage')}
        </label>
        <Input
          id="admin-username"
          className="w-full border-stone-400 bg-white shadow-sm focus-visible:border-stone-700 dark:border-white/30 dark:bg-white/5 dark:focus-visible:border-white/60 dark:focus-visible:ring-white/20"
          name="username"
          type="text"
          required
          autoComplete="username"
        />
        <label htmlFor="admin-password" className="font-semibold text-base">
          {t('PasswordSignInMessage')}
        </label>
        <Input
          id="admin-password"
          className="w-full border-stone-400 bg-white shadow-sm focus-visible:border-stone-700 dark:border-white/30 dark:bg-white/5 dark:focus-visible:border-white/60 dark:focus-visible:ring-white/20"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
        {error && (
          <p className="col-start-2 font-semibold text-red-500 text-sm">
            {t('ErrorMessage')}
          </p>
        )}
        <Button type="submit" className="col-start-2 w-1/2 justify-self-end">
          {t('Submit')}
        </Button>
      </section>
    </form>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-secondary p-2">{icon}</div>
        <div>
          <div className="text-muted-foreground text-sm">{label}</div>
          <div className="font-semibold text-xl">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto w-full max-w-5xl">
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" />
            Admin 未启用
          </div>
          <p className="text-muted-foreground text-sm">
            缺少环境变量：{missing.join(', ')}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <main className="mx-auto w-full max-w-5xl">
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            NodeStatus Admin 请求失败
          </div>
          <p className="text-muted-foreground text-sm">{message}</p>
        </CardContent>
      </Card>
    </main>
  );
}

function EventRow({ event }: { event: NodeStatusAdminEvent }) {
  return (
    <tr className="border-b last:border-0">
      <Td>{event.username}</Td>
      <Td>
        {event.resolved ? (
          <Badge variant="secondary">已恢复</Badge>
        ) : (
          <Badge>未恢复</Badge>
        )}
      </Td>
      <Td>{formatDate(event.created_at)}</Td>
      <Td>{event.resolved ? formatDate(event.updated_at) : '-'}</Td>
      <Td>
        <form action={deleteEventAction} className="flex justify-end">
          <input type="hidden" name="id" value={event.id} />
          <ConfirmSubmitButton
            type="submit"
            variant="destructive"
            size="sm"
            className="gap-2"
            message={`确认删除 ${event.username} 的故障记录?`}
          >
            <Trash2 className="size-4" />
            删除
          </ConfirmSubmitButton>
        </form>
      </Td>
    </tr>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-10 rounded-md border border-input bg-background px-3 text-sm outline-hidden transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
        props.className,
      )}
    />
  );
}

function StatusBadge({ online }: { online: boolean | null }) {
  if (online === null) return <Badge variant="secondary">未知</Badge>;
  return online ? (
    <Badge className="gap-1 bg-green-600 text-white">
      <CheckCircle2 className="size-3" />
      在线
    </Badge>
  ) : (
    <Badge variant="destructive">离线</Badge>
  );
}

function Th({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={cn('px-3 py-2 text-left font-medium', className)}
    />
  );
}

function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={cn('px-3 py-3 align-middle', className)} />;
}

function formatUptime(seconds?: number) {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days ? `${days}d ${hours}h` : `${hours}h`;
}

function formatDate(value: string | number) {
  const date = new Date(
    typeof value === 'number' && value < 1_000_000_000_000
      ? value * 1000
      : value,
  );
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}
