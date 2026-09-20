import { createHmac, timingSafeEqual } from 'node:crypto';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import zhLocale from 'i18n-iso-countries/langs/zh.json';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Pencil,
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
  updateOrderNodeStatusAdminServer,
} from '@/lib/nodestatus-admin';
import { cn } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';

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

async function updateServerAction(formData: FormData) {
  'use server';

  await requireAdmin();
  const username = text(formData, 'username');
  const password = text(formData, 'password');
  const name = text(formData, 'name');
  const type = text(formData, 'type');
  const location = text(formData, 'location');
  const regionInput = text(formData, 'region');
  if (!username || !name || !type || !location || !regionInput) {
    throw new Error('server fields are required');
  }
  const region = normalizeRegion(regionInput);
  if (!region)
    throw new Error('region must be an ISO alpha-2 code or country name');

  await updateNodeStatusAdminServer(username, {
    name,
    type,
    location,
    region,
    disabled: formData.get('disabled') === 'on',
    ...(password ? { password } : {}),
  });
  revalidatePath('/admin');
  redirect('/admin');
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

async function moveServerAction(formData: FormData) {
  'use server';

  await requireAdmin();

  const id = Number(text(formData, 'id'));
  const direction = text(formData, 'direction');
  if (direction !== 'up' && direction !== 'down') return;

  const order = (await listNodeStatusAdminServers()).map((server) => server.id);
  const index = order.indexOf(id);
  const target = direction === 'up' ? index - 1 : index + 1;

  if (index < 0 || target < 0 || target >= order.length) return;

  [order[index], order[target]] = [order[target], order[index]];
  await updateOrderNodeStatusAdminServer(order);
  revalidatePath('/admin');
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; edit?: string }>;
}) {
  const missing = [
    !getEnv('NodeStatusBaseUrl') && 'NodeStatusBaseUrl',
    !getEnv('NodeStatusWebUsername') && 'NodeStatusWebUsername',
    !getEnv('NodeStatusWebPassword') && 'NodeStatusWebPassword',
  ].filter(Boolean) as string[];
  if (missing.length) return <SetupNotice missing={missing} />;

  const params = await searchParams;
  if (!(await isAdminSignedIn())) {
    return <AdminLogin error={params?.error === '1'} />;
  }

  const t = await getTranslations('AdminPage');

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
    const editingServer = params?.edit
      ? rows.find((server) => server.username === params.edit)
      : null;

    return (
      <main className="mx-auto grid w-full max-w-5xl gap-4 bg-background p-4 md:gap-6 md:p-10 md:pt-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <h1 className="font-semibold text-xl">{t('title')}</h1>
            <Link href={'/'}>
              <div className="flex flex-none cursor-pointer items-center gap-0.5 break-all font-semibold text-xl leading-none tracking-tight transition-opacity duration-300 hover:opacity-50">
                <BackIcon />
                {getEnv('NodeStatusWebUsername') || 'admin'}
              </div>
            </Link>
          </div>
          {getEnv('NEXT_PUBLIC_NodeStatus') !== 'true' && (
            <Badge variant="outline" className="w-fit">
              {t('nodeStatusNotEnabled')}
            </Badge>
          )}
          {!snapshot && (
            <Badge variant="secondary" className="w-fit">
              {t('snapshotUnavailable')}
            </Badge>
          )}
        </header>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Server className="size-4" />}
            label={t('totalNodes')}
            value={rows.length}
          />
          <StatCard
            icon={<Wifi className="size-4" />}
            label={t('online')}
            value={onlineCount ?? '-'}
          />
          <StatCard
            icon={<WifiOff className="size-4" />}
            label={t('offline')}
            value={onlineCount === null ? '-' : rows.length - onlineCount}
          />
          <StatCard
            icon={<AlertTriangle className="size-4" />}
            label={t('unresolvedEvents')}
            value={unresolvedCount ?? '-'}
          />
        </section>

        <Card>
          <details>
            <summary className="cursor-pointer select-none p-6 font-semibold text-base leading-none tracking-tight">
              {t('addNode')}
            </summary>
            <CardContent>
              <form
                action={createServerAction}
                className="grid gap-3 md:grid-cols-3"
              >
                <ServerFields showUsername passwordRequired />
                <Button
                  type="submit"
                  className="w-1/2 gap-2 justify-self-end md:col-start-3"
                >
                  <Plus className="size-4" />
                  {t('create')}
                </Button>
              </form>
            </CardContent>
          </details>
        </Card>

        {editingServer && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('editNode', {
                  name: editingServer.name || editingServer.username,
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={updateServerAction}
                className="grid gap-3 md:grid-cols-3"
              >
                <input
                  type="hidden"
                  name="username"
                  value={editingServer.username}
                />
                <ServerFields server={editingServer} />
                <div className="col-span-full flex justify-end gap-2">
                  <Button asChild variant="outline">
                    <Link href="/admin">{t('cancel')}</Link>
                  </Button>
                  <Button type="submit">{t('save')}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('nodeManagement')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <Th>{t('node')}</Th>
                  <Th>{t('status')}</Th>
                  <Th>{t('region')}</Th>
                  <Th>{t('type')}</Th>
                  <Th>{t('load')}</Th>
                  <Th>{t('uptime')}</Th>
                  <Th className="text-right">{t('actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((server, index) => (
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
                          <Badge variant="secondary">{t('disabled')}</Badge>
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
                        <form action={moveServerAction}>
                          <input type="hidden" name="id" value={server.id} />
                          <input type="hidden" name="direction" value="up" />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            disabled={index === 0}
                            aria-label={t('moveUp')}
                            title={t('moveUp')}
                            className="px-2"
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                        </form>
                        <form action={moveServerAction}>
                          <input type="hidden" name="id" value={server.id} />
                          <input type="hidden" name="direction" value="down" />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            disabled={index === rows.length - 1}
                            aria-label={t('moveDown')}
                            title={t('moveDown')}
                            className="px-2"
                          >
                            <ArrowDown className="size-4" />
                          </Button>
                        </form>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <Link
                            href={`/admin?edit=${encodeURIComponent(server.username)}`}
                          >
                            <Pencil className="size-4" />
                            {t('edit')}
                          </Link>
                        </Button>
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
                            {server.disabled ? t('enable') : t('disable')}
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
                            message={t('confirmDeleteNode', {
                              name: server.name || server.username,
                            })}
                          >
                            <Trash2 className="size-4" />
                            {t('delete')}
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
              <CardTitle className="text-base">{t('events')}</CardTitle>
              {events && (
                <form action={deleteAllEventsAction}>
                  <ConfirmSubmitButton
                    type="submit"
                    variant="outline"
                    size="sm"
                    message={t('confirmClearEvents')}
                  >
                    {t('clear')}
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <Th>{t('node')}</Th>
                  <Th>{t('status')}</Th>
                  <Th>{t('createdAt')}</Th>
                  <Th>{t('resolvedAt')}</Th>
                  <Th className="text-right">{t('actions')}</Th>
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
                      {t('noEvents')}
                    </Td>
                  </tr>
                )}
                {!events && (
                  <tr>
                    <Td
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      {t('eventsUnavailable')}
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

function ServerFields({
  server,
  showUsername = false,
  passwordRequired = false,
}: {
  server?: NodeStatusAdminServer;
  showUsername?: boolean;
  passwordRequired?: boolean;
}) {
  const t = useTranslations('AdminPage');
  return (
    <>
      {showUsername && (
        <Input name="username" placeholder={t('username')} required />
      )}
      <Input
        name="password"
        placeholder={passwordRequired ? t('password') : t('passwordKeep')}
        required={passwordRequired}
        type="password"
      />
      <Input
        name="name"
        placeholder={t('name')}
        required
        defaultValue={server?.name}
      />
      <Input
        name="type"
        placeholder={t('typePlaceholder')}
        required
        defaultValue={server?.type}
      />
      <Input
        name="location"
        placeholder={t('locationPlaceholder')}
        required
        defaultValue={server?.location}
      />
      <RegionAutoComplete
        name="region"
        placeholder={t('regionPlaceholder')}
        required
        defaultValue={server?.region}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          name="disabled"
          type="checkbox"
          className="size-4 rounded border"
          defaultChecked={server?.disabled}
        />
        {t('disable')}
      </label>
    </>
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
  const t = useTranslations('AdminPage');
  return (
    <main className="mx-auto w-full max-w-5xl">
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" />
            {t('adminDisabled')}
          </div>
          <p className="text-muted-foreground text-sm">
            {t('missingEnv', { vars: missing.join(', ') })}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function ErrorNotice({ message }: { message: string }) {
  const t = useTranslations('AdminPage');
  return (
    <main className="mx-auto w-full max-w-5xl">
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            {t('requestFailed')}
          </div>
          <p className="text-muted-foreground text-sm">{message}</p>
        </CardContent>
      </Card>
    </main>
  );
}

function EventRow({ event }: { event: NodeStatusAdminEvent }) {
  const t = useTranslations('AdminPage');
  return (
    <tr className="border-b last:border-0">
      <Td>{event.username}</Td>
      <Td>
        {event.resolved ? (
          <Badge variant="secondary">{t('resolved')}</Badge>
        ) : (
          <Badge>{t('unresolved')}</Badge>
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
            message={t('confirmDeleteEvent', { name: event.username })}
          >
            <Trash2 className="size-4" />
            {t('delete')}
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
  const t = useTranslations('AdminPage');
  if (online === null) return <Badge variant="secondary">{t('unknown')}</Badge>;
  return online ? (
    <Badge className="gap-1 bg-green-600 text-white">
      <CheckCircle2 className="size-3" />
      {t('online')}
    </Badge>
  ) : (
    <Badge variant="destructive">{t('offline')}</Badge>
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
