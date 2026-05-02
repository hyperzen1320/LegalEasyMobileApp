import * as SecureStore from "expo-secure-store";
import { getApiBaseUrl } from "./config";

const TOKEN_KEY = "legaleasy_token";

export type MobileUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: "global_admin" | "partner_admin" | "user";
  partnerId: string | null;
};

export type MobilePartner = {
  id: string;
  name: string;
  slug: string;
  plan: "trial" | "solo" | "office" | "chambers";
  subscription: {
    status: string;
    startDate: string;
    endDate: string;
  };
};

export type AdminPartner = {
  id: string;
  name: string;
  slug: string;
  primaryEmail: string;
  primaryContactName: string;
  phone: string;
  city: string;
  state: string;
  plan: "trial" | "solo" | "office" | "chambers";
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
};

export type AdminPartnerDetail = AdminPartner & {
  subscription: {
    status: string;
    startDate: string;
    endDate: string;
    seatLimit: number;
    matterLimit: number;
  };
  isDeleted: boolean;
  updatedAt: string;
};

export type AdminPlan = {
  key: "trial" | "solo" | "office" | "chambers";
  label: string;
  tagline: string;
  description: string;
  priceAmount: number;
  priceLabel: string;
  priceSuffix: string;
  billingCycle: "trial" | "monthly" | "yearly" | "bespoke";
  features: string[];
  seatLimit: number;
  matterLimit: number;
  isTrial: boolean;
  isPopular: boolean;
  showOnLanding: boolean;
  isActive: boolean;
  sortOrder: number;
  ctaLabel: string;
  updatedAt: string;
};

export type AdminActivity = {
  id: string;
  actorName: string;
  actorEmail: string;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DashboardData = {
  stats: {
    totalPartners: number;
    activePartners: number;
    trialPartners: number;
    totalUsers: number;
  };
  recentPartners: Array<{
    id: string;
    name: string;
    slug: string;
    primaryEmail: string;
    plan: string;
    status: string;
    startDate: string;
    endDate: string;
    createdAt: string;
  }>;
  adminName: string;
};

/* ─────────── Token storage ─────────── */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/* ─────────── Fetch wrapper ─────────── */
export class ApiError extends Error {
  status: number;
  // Full parsed JSON response body, when the server returned one. Some
  // endpoints (smart-delete) include structured codes on 4xx responses
  // that callers need to read; throwing away the body would force them
  // back to string-matching the message.
  body: Record<string, unknown> | null;
  constructor(
    message: string,
    status: number,
    body: Record<string, unknown> | null = null
  ) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      `Couldn't reach the server at ${base}. Check your network.`,
      0
    );
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }

  if (!res.ok) {
    const body =
      data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : null;
    const msg =
      (body?.error as string | undefined) ??
      `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, body);
  }

  return data as T;
}

/* ─────────── Auth flows ─────────── */
export async function login(email: string, password: string): Promise<MobileUser> {
  const data = await api<{ token: string; user: MobileUser }>(
    "/api/mobile/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
  await setToken(data.token);
  return data.user;
}

export async function getMe(): Promise<{ user: MobileUser; partner: MobilePartner | null }> {
  return api<{ user: MobileUser; partner: MobilePartner | null }>(
    "/api/mobile/me",
    { method: "GET" }
  );
}

export async function logout(): Promise<void> {
  await clearToken();
}

export async function requestAccess(payload: {
  name: string;
  chambers: string;
  email: string;
  phone: string;
  message?: string;
}): Promise<{ ok: true; id: string }> {
  return api<{ ok: true; id: string }>("/api/mobile/access-requests", {
    method: "POST",
    body: JSON.stringify({ ...payload, source: "mobile" }),
  });
}

/* ─────────── Admin endpoints (for global_admin) ─────────── */
export async function adminDashboard(): Promise<DashboardData> {
  return api<DashboardData>("/api/admin/dashboard", { method: "GET" });
}

export async function adminListPartners(): Promise<{ partners: AdminPartner[] }> {
  return api<{ partners: AdminPartner[] }>("/api/admin/partners", {
    method: "GET",
  });
}

export async function adminGetPartner(id: string): Promise<{
  partner: AdminPartnerDetail;
  partnerAdmin: { id: string; email: string } | null;
}> {
  return api<{
    partner: AdminPartnerDetail;
    partnerAdmin: { id: string; email: string } | null;
  }>(`/api/admin/partners/${id}`, { method: "GET" });
}

export async function adminCreatePartner(payload: {
  name: string;
  primaryEmail: string;
  primaryContactName: string;
  phone: string;
  city?: string;
  state?: string;
  plan: "trial" | "solo" | "office" | "chambers";
  trialDays: number;
  password: string;
}): Promise<{ ok: true; partner: { id: string; slug: string; name: string; primaryEmail: string } }> {
  return api("/api/admin/partners", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdatePartner(
  id: string,
  payload: Partial<{
    name: string;
    primaryContactName: string;
    phone: string;
    city: string;
    state: string;
    plan: "trial" | "solo" | "office" | "chambers";
    subscriptionStatus:
      | "trial"
      | "active"
      | "past_due"
      | "cancelled"
      | "suspended";
    extendTrialDays: number;
  }>
): Promise<{ ok: true; changes: string[] }> {
  return api(`/api/admin/partners/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function adminDeletePartner(id: string): Promise<{ ok: true }> {
  return api(`/api/admin/partners/${id}`, { method: "DELETE" });
}

export async function adminResetPartnerPassword(
  id: string,
  password: string
): Promise<{ ok: true }> {
  return api(`/api/admin/partners/${id}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

/* ─────────── Partner-side endpoints ─────────── */

export type PartnerCaseHearing = {
  date: string;
  status: string;
  outcome: string;
  nextDate: string | null;
};

export type PartnerCase = {
  id: string;
  caseNo: string;
  fileNo: string;
  cnr: string;
  title: string;
  clientName: string;
  clientPhone: string;
  clientWhatsapp: string;
  clientAddress: string;
  oppositeParty: string;
  appearingFor: string;
  oppositeAdvocate: string;
  iaNumbers: string;
  courtName: string;
  courtHall: string;
  courtPlace: string;
  status: string;
  nextHearingDate: string | null;
  lastHearingDate: string | null;
  hearings: PartnerCaseHearing[];
  createdAt: string;
  updatedAt: string;
};

export type PartnerCaseInput = {
  caseNo: string;
  fileNo?: string;
  cnr?: string;
  clientName?: string;
  clientPhone?: string;
  clientWhatsapp?: string;
  clientAddress?: string;
  oppositeParty?: string;
  appearingFor?: string;
  oppositeAdvocate?: string;
  iaNumbers?: string;
  courtName?: string;
  courtHall?: string;
  courtPlace?: string;
  status?: string;
  nextHearingDate?: string | null;
  lastHearingDate?: string | null;
};

export type PartnerDashboardData = {
  stats: {
    todayHearings: number;
    tomorrowHearings: number;
    pendingDates: number;
    caseVault: number;
  };
  todaysBoard: Array<{
    id: string;
    caseNo: string;
    status: string;
    clientName: string;
    courtName: string;
    courtPlace: string;
    nextHearingDate: string | null;
  }>;
};

export async function partnerDashboard(): Promise<PartnerDashboardData> {
  return api<PartnerDashboardData>("/api/app/dashboard", { method: "GET" });
}

export async function partnerListCases(): Promise<{ cases: PartnerCase[] }> {
  return api<{ cases: PartnerCase[] }>("/api/app/cases", { method: "GET" });
}

export async function partnerCreateCase(
  payload: PartnerCaseInput
): Promise<{ ok: true; id: string }> {
  return api("/api/app/cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function partnerGetCase(
  id: string
): Promise<{ case: PartnerCase; officeName: string }> {
  return api(`/api/app/cases/${id}`, { method: "GET" });
}

export async function partnerUpdateCase(
  id: string,
  patch: Partial<PartnerCaseInput>
): Promise<{ ok: true; case: PartnerCase }> {
  return api(`/api/app/cases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function partnerDeleteCase(
  id: string
): Promise<{ ok: true }> {
  return api(`/api/app/cases/${id}`, { method: "DELETE" });
}

/* ─── Clients ─── */

export type PartnerClient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  caseCount: number;
};

export type PartnerClientInput = {
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
};

export async function partnerListClients(): Promise<{
  clients: PartnerClient[];
}> {
  return api<{ clients: PartnerClient[] }>("/api/app/clients", {
    method: "GET",
  });
}

export async function partnerCreateClient(
  payload: PartnerClientInput
): Promise<{ ok: true; id: string }> {
  return api("/api/app/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ─── Users (office team / RBAC) ─── */

export type PartnerStaffUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  userType: string;
  role: string;
  phone: string;
  designation: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  isYou?: boolean;
};

export type PartnerStaffUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  role?: string;
  designation?: string;
  phone?: string;
};

export type PartnerStaffUserPatch = {
  firstName?: string;
  lastName?: string;
  role?: string;
  designation?: string;
  phone?: string;
  active?: boolean;
  password?: string;
};

export async function partnerListUsers(): Promise<{
  users: PartnerStaffUser[];
  currentUserId: string;
}> {
  return api<{ users: PartnerStaffUser[]; currentUserId: string }>(
    "/api/app/users",
    { method: "GET" }
  );
}

export async function partnerCreateUser(
  payload: PartnerStaffUserInput
): Promise<{ ok: true; user: PartnerStaffUser }> {
  return api("/api/app/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function partnerUpdateUser(
  id: string,
  payload: PartnerStaffUserPatch
): Promise<{ ok: true; user: PartnerStaffUser }> {
  return api(`/api/app/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function partnerDeleteUser(
  id: string
): Promise<{ ok: true }> {
  return api(`/api/app/users/${id}`, { method: "DELETE" });
}

/* ─── Profile ─── */

export type PartnerProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  state: string;
  country: string;
  officeAddress: string;
  barEnrolmentNo: string;
  designation: string;
  profilePhoto: string;
};

export type PartnerProfileInput = {
  name?: string;
  phone?: string;
  state?: string;
  country?: string;
  officeAddress?: string;
  barEnrolmentNo?: string;
  designation?: string;
  profilePhoto?: string;
};

export async function partnerGetProfile(): Promise<{
  profile: PartnerProfile;
}> {
  return api<{ profile: PartnerProfile }>("/api/app/profile", {
    method: "GET",
  });
}

export async function partnerUpdateProfile(
  payload: PartnerProfileInput
): Promise<{ ok: true; profile: PartnerProfile }> {
  return api("/api/app/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/* ─── Prompt templates ─── */

export type PartnerPrompt = {
  id: string;
  title: string;
  body: string;
  category: string;
  isSeeded: boolean;
  updatedAt?: string;
};

export type PartnerPromptInput = {
  title: string;
  body?: string;
  category?: string;
};

export async function partnerListPrompts(): Promise<{
  prompts: PartnerPrompt[];
}> {
  return api<{ prompts: PartnerPrompt[] }>("/api/app/prompts", {
    method: "GET",
  });
}

export async function partnerCreatePrompt(
  payload: PartnerPromptInput
): Promise<{ ok: true; prompt: PartnerPrompt }> {
  return api("/api/app/prompts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function partnerUpdatePrompt(
  id: string,
  payload: Partial<PartnerPromptInput>
): Promise<{ ok: true; prompt: PartnerPrompt }> {
  return api(`/api/app/prompts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function partnerDeletePrompt(
  id: string
): Promise<{ ok: true }> {
  return api(`/api/app/prompts/${id}`, { method: "DELETE" });
}

/* ─── Workflow boards ─── */

export type BoardColor =
  | "forest"
  | "copper"
  | "sea"
  | "terracotta"
  | "ochre"
  | "plum"
  | "ink";

export type PartnerBoard = {
  id: string;
  title: string;
  description: string;
  color: BoardColor;
  isSeeded: boolean;
  cardCount: number;
  updatedAt: string;
  createdAt: string;
};

export type PartnerBoardInput = {
  title: string;
  description?: string;
  color?: BoardColor;
};

export async function partnerListBoards(): Promise<{
  boards: PartnerBoard[];
}> {
  return api<{ boards: PartnerBoard[] }>("/api/app/boards", {
    method: "GET",
  });
}

export async function partnerCreateBoard(
  payload: PartnerBoardInput
): Promise<{ ok: true; board: PartnerBoard }> {
  return api("/api/app/boards", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ─── Board state — lists, tasks, edges, members ───────────────────────
   These types mirror the web app's `/api/app/boards/[id]/full` response
   one-for-one. Keep them in sync if the web payload ever changes. */

export type BoardMember = { id: string; name: string; role: string };

export type CanvasList = {
  id: string;
  title: string;
  sortOrder: number;
  position: { x: number; y: number };
  width: number;
  color: string | null;
};

export type CanvasEdge = {
  id: string;
  sourceListId: string;
  targetListId: string;
  sourceHandle: string;
  targetHandle: string;
  label: string;
  color: string | null;
  style: "solid" | "dashed";
};

export type CardChecklistSummary = {
  totalChecklists: number;
  totalItems: number;
  doneItems: number;
};

export type CardPriority = "low" | "medium" | "high" | null;

export type PreviewTask = {
  id: string;
  listId: string;
  title: string;
  description: string;
  sortOrder: number;
  assignee: { id: string; name: string; role: string } | null;
  dueDate: string | null;
  priority: CardPriority;
  checklistSummary: CardChecklistSummary;
  hasDescription: boolean;
  updatedAt: string;
};

export type BoardFullResponse = {
  board: {
    id: string;
    title: string;
    description: string;
    color: BoardColor;
  };
  lists: CanvasList[];
  edges: CanvasEdge[];
  tasks: PreviewTask[];
  members: BoardMember[];
  role: string;
  currentUserId: string;
};

export async function partnerGetBoardFull(
  id: string
): Promise<BoardFullResponse> {
  return api<BoardFullResponse>(`/api/app/boards/${id}/full`, {
    method: "GET",
  });
}

/* ─── Lists CRUD ─────────────────────────────────────────────────────── */

export async function partnerCreateList(
  boardId: string,
  payload: { title: string }
): Promise<{
  ok: true;
  list: { id: string; title: string; sortOrder: number };
}> {
  return api(`/api/app/boards/${boardId}/lists`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function partnerUpdateList(
  listId: string,
  payload: { title?: string; color?: string | null }
): Promise<{
  ok: true;
  list: { id: string; title: string; sortOrder: number };
}> {
  return api(`/api/app/lists/${listId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export type DeleteRequestRequiredError = {
  error: string;
  code: "delete_request_required";
  targetType: "list" | "task" | "board" | "case" | "client" | "court" | "prompt";
  targetId: string;
  targetName: string;
};

/**
 * Reads a thrown ApiError to see if the server is asking the user to file
 * a delete request instead of direct-deleting. Returns the structured
 * payload when that's the case, null otherwise.
 */
export function deleteRequestRequired(
  err: unknown
): DeleteRequestRequiredError | null {
  if (!(err instanceof ApiError)) return null;
  if (err.status !== 403) return null;
  const body = err.body;
  if (!body || body.code !== "delete_request_required") return null;
  return body as unknown as DeleteRequestRequiredError;
}

export async function partnerDeleteList(
  listId: string
): Promise<{ ok: true; cardsRemoved?: number }> {
  return api(`/api/app/lists/${listId}`, { method: "DELETE" });
}

/* ─── Tasks (cards) CRUD ─────────────────────────────────────────────── */

export type TaskFullChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  sortOrder: number;
};

export type TaskFullChecklist = {
  id: string;
  title: string;
  sortOrder: number;
  items: TaskFullChecklistItem[];
};

export type SerializedTaskFull = {
  id: string;
  listId: string;
  title: string;
  description: string;
  sortOrder: number;
  assignee: { id: string; name: string; role: string } | null;
  dueDate: string | null;
  priority: CardPriority;
  checklistSummary: CardChecklistSummary;
  hasDescription: boolean;
  updatedAt: string;
  checklists: TaskFullChecklist[];
};

export type TaskFullResponse = {
  task: SerializedTaskFull;
  activity: Array<{
    id: string;
    action: string;
    actorName: string;
    message: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
};

export async function partnerCreateTask(
  boardId: string,
  payload: { listId: string; title: string }
): Promise<{ ok: true; task: PreviewTask }> {
  return api(`/api/app/boards/${boardId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function partnerGetTask(taskId: string): Promise<TaskFullResponse> {
  return api<TaskFullResponse>(`/api/app/tasks/${taskId}`, { method: "GET" });
}

export async function partnerUpdateTask(
  taskId: string,
  payload: {
    title?: string;
    description?: string;
    assignedToUserId?: string | null;
    dueDate?: string | null;
    priority?: CardPriority;
  }
): Promise<{ ok: true }> {
  return api(`/api/app/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function partnerDeleteTask(
  taskId: string
): Promise<{ ok: true }> {
  return api(`/api/app/tasks/${taskId}`, { method: "DELETE" });
}

export async function partnerMoveTask(
  taskId: string,
  payload: { toListId: string; toIndex: number }
): Promise<{ ok: true; listId: string; sortOrder: number }> {
  return api(`/api/app/tasks/${taskId}/move`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ─── Checklists ─────────────────────────────────────────────────────── */

export async function partnerAddChecklist(
  taskId: string,
  payload: { title: string }
): Promise<{ ok: true; checklist: TaskFullChecklist }> {
  return api(`/api/app/tasks/${taskId}/checklists`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function partnerUpdateChecklist(
  taskId: string,
  clId: string,
  payload: { title: string }
): Promise<{ ok: true }> {
  return api(`/api/app/tasks/${taskId}/checklists/${clId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function partnerDeleteChecklist(
  taskId: string,
  clId: string
): Promise<{ ok: true }> {
  return api(`/api/app/tasks/${taskId}/checklists/${clId}`, {
    method: "DELETE",
  });
}

export async function partnerAddChecklistItem(
  taskId: string,
  clId: string,
  payload: { text: string }
): Promise<{ ok: true; item: TaskFullChecklistItem }> {
  return api(`/api/app/tasks/${taskId}/checklists/${clId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function partnerUpdateChecklistItem(
  taskId: string,
  clId: string,
  itemId: string,
  payload: { text?: string; done?: boolean }
): Promise<{ ok: true }> {
  return api(
    `/api/app/tasks/${taskId}/checklists/${clId}/items/${itemId}`,
    { method: "PATCH", body: JSON.stringify(payload) }
  );
}

export async function partnerDeleteChecklistItem(
  taskId: string,
  clId: string,
  itemId: string
): Promise<{ ok: true }> {
  return api(
    `/api/app/tasks/${taskId}/checklists/${clId}/items/${itemId}`,
    { method: "DELETE" }
  );
}

/* ─── Activity, live feed, presence, delete requests ───────────────── */

export type LiveActivityRow = {
  id: string;
  actorUserId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string;
  message: string;
  metadata: Record<string, unknown>;
  boardId: string | null;
  createdAt: string;
};

export type LiveFeedResponse = {
  events: LiveActivityRow[];
  latestId: string | null;
  serverTime: number;
  truncated?: boolean;
};

export async function partnerLiveFeed(opts: {
  since?: string | null;
  boardId?: string | null;
  limit?: number;
}): Promise<LiveFeedResponse> {
  const qs = new URLSearchParams();
  if (opts.since) qs.set("since", opts.since);
  if (opts.boardId) qs.set("board", opts.boardId);
  if (opts.limit) qs.set("limit", String(opts.limit));
  return api<LiveFeedResponse>(
    `/api/app/activity/live?${qs.toString()}`,
    { method: "GET" }
  );
}

export type ActivityHistoryRow = {
  id: string;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string;
  message: string;
  metadata: Record<string, unknown>;
  boardId: string | null;
  createdAt: string;
};

export async function partnerActivityHistory(opts: {
  boardId?: string;
  limit?: number;
  before?: string;
}): Promise<{
  activity: ActivityHistoryRow[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const qs = new URLSearchParams();
  if (opts.boardId) qs.set("board", opts.boardId);
  qs.set("limit", String(opts.limit ?? 50));
  if (opts.before) qs.set("before", opts.before);
  return api(`/api/app/activity?${qs.toString()}`, { method: "GET" });
}

export type PartnerPresenceUser = {
  userId: string;
  name: string;
  role: string;
  designation: string;
  lastBeat: string;
  isYou: boolean;
};

export async function partnerHeartbeat(
  boardId: string
): Promise<{ active: PartnerPresenceUser[] }> {
  return api(`/api/app/boards/${boardId}/heartbeat`, {
    method: "POST",
    body: "{}",
  });
}

export type DeleteRequestRow = {
  id: string;
  requesterName: string;
  targetType: string;
  targetId: string;
  targetName: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "obsolete";
  createdAt: string;
  reviewedByName?: string;
  reviewerNote?: string;
};

export async function partnerListDeleteRequests(opts: {
  status?: "pending" | "approved" | "rejected" | "obsolete";
  boardId?: string;
  limit?: number;
}): Promise<{ requests: DeleteRequestRow[] }> {
  const qs = new URLSearchParams();
  if (opts.status) qs.set("status", opts.status);
  if (opts.boardId) qs.set("boardId", opts.boardId);
  if (opts.limit) qs.set("limit", String(opts.limit));
  return api(`/api/app/delete-requests?${qs.toString()}`, { method: "GET" });
}

export async function partnerCreateDeleteRequest(payload: {
  targetType: "list" | "task" | "board" | "case" | "client" | "court" | "prompt";
  targetId: string;
  reason: string;
}): Promise<{ ok: true; id: string }> {
  return api(`/api/app/delete-requests`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function partnerApproveDeleteRequest(
  id: string,
  note?: string
): Promise<{ ok: true }> {
  return api(`/api/app/delete-requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ note: note ?? "" }),
  });
}

export async function partnerRejectDeleteRequest(
  id: string,
  note?: string
): Promise<{ ok: true }> {
  return api(`/api/app/delete-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ note: note ?? "" }),
  });
}

export async function partnerDeleteRequestCount(opts?: {
  boardId?: string;
}): Promise<{ count: number }> {
  const qs = new URLSearchParams();
  if (opts?.boardId) qs.set("boardId", opts.boardId);
  const suffix = qs.toString();
  return api(
    `/api/app/delete-requests/count${suffix ? `?${suffix}` : ""}`,
    { method: "GET" }
  );
}

/* ─── Courts ─── */

export type PartnerCourt = {
  id: string;
  name: string;
  number: string;
  place: string;
  caseCount: number;
};

export type PartnerCourtInput = {
  name: string;
  number?: string;
  place?: string;
};

export async function partnerListCourts(): Promise<{
  courts: PartnerCourt[];
}> {
  return api<{ courts: PartnerCourt[] }>("/api/app/courts", { method: "GET" });
}

export async function partnerCreateCourt(
  payload: PartnerCourtInput
): Promise<{ ok: true; court: PartnerCourt }> {
  return api("/api/app/courts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ─── Hearing Track ─── */

export type HearingBucket = "today" | "tomorrow" | "pending";

export type PartnerHearingItem = {
  id: string;
  caseNo: string;
  fileNo: string;
  cnr: string;
  clientName: string;
  clientPhone: string;
  clientWhatsapp: string;
  oppositeParty: string;
  courtName: string;
  courtPlace: string;
  status: string;
  nextHearingDate: string | null;
  lastHearingDate: string | null;
};

export type PartnerHearingsResponse = {
  bucket: HearingBucket;
  items: PartnerHearingItem[];
  counts: { today: number; tomorrow: number; pending: number };
  officeName: string;
};

export async function partnerListHearings(
  bucket: HearingBucket
): Promise<PartnerHearingsResponse> {
  return api<PartnerHearingsResponse>(
    `/api/app/hearings?bucket=${bucket}`,
    { method: "GET" }
  );
}

/* ─────────── Activity endpoint (admin) ─────────── */

export async function adminListActivity(
  filter: "all" | "created" | "updated" | "password" | "danger" | "plan" = "all",
  limit = 50
): Promise<{ activities: AdminActivity[]; total: number }> {
  const params = new URLSearchParams({ filter, limit: String(limit) });
  return api(`/api/admin/activity?${params.toString()}`, { method: "GET" });
}

export async function adminListPlans(): Promise<{ plans: AdminPlan[] }> {
  return api<{ plans: AdminPlan[] }>("/api/admin/subscriptions", {
    method: "GET",
  });
}

export async function adminGetPlan(
  key: string
): Promise<{ plan: AdminPlan }> {
  return api<{ plan: AdminPlan }>(`/api/admin/subscriptions/${key}`, {
    method: "GET",
  });
}

export async function adminUpdatePlan(
  key: string,
  payload: Partial<{
    label: string;
    tagline: string;
    description: string;
    priceAmount: number;
    priceLabel: string;
    priceSuffix: string;
    billingCycle: "trial" | "monthly" | "yearly" | "bespoke";
    features: string[];
    seatLimit: number;
    matterLimit: number;
    isPopular: boolean;
    showOnLanding: boolean;
    isActive: boolean;
    sortOrder: number;
    ctaLabel: string;
  }>
): Promise<{ ok: true; changes: string[] }> {
  return api(`/api/admin/subscriptions/${key}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

