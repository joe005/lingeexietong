/**
 * HTTP API 客户端：唯一真实数据通道（base path /api）。
 *
 * - 响应字段 snake_case 原样返回，不做字段转换；
 * - 错误统一解析为 ApiRequestError（status / code / message / fields），
 *   与契约错误结构 {"error":{"code","message","fields?"}} 一一对应；
 * - 不臆造契约之外的 API 行为：端点、请求与响应形状均按
 *   docs/wi-t1000006/technical-contract.md 实现。
 */
import type {
  ApiErrorBody,
  CreateFloorBody,
  CreateMaintenanceEventBody,
  CreateMallBody,
  CreateRobotBody,
  CreateTaskBody,
  Floor,
  FloorDetail,
  FloorFilter,
  MaintenanceEvent,
  MaintenanceEventDetail,
  MaintenanceEventFilter,
  MallDetail,
  MallSummary,
  ReportRobotStatusBody,
  ResolveMaintenanceEventBody,
  Robot,
  RobotDetail,
  RobotFilter,
  Stats,
  Task,
  TaskDetail,
  TaskFilter,
  UpdateFloorBody,
  UpdateMallBody,
  UpdateRobotBody,
} from './types';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function isApiRequestError(value: unknown): value is ApiRequestError {
  return value instanceof ApiRequestError;
}

function toApiRequestError(value: unknown): ApiRequestError {
  if (isApiRequestError(value)) return value;
  return new ApiRequestError(
    0,
    'UNKNOWN',
    value instanceof Error ? value.message : String(value),
  );
}

export { toApiRequestError };

function queryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  if (entries.length === 0) return '';
  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `?${search}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    // 传输层失败（后端未启动/网络不可达），不属于 API 业务错误。
    throw new ApiRequestError(0, 'NETWORK_ERROR', '无法连接服务，请确认后端服务已启动后重试。');
  }
  if (!response.ok) {
    let code = 'UNKNOWN';
    let message = `请求失败（HTTP ${response.status}）`;
    let fields: Record<string, string> | undefined;
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (body && typeof body.error === 'object' && body.error !== null) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
        fields = body.error.fields;
      }
    } catch {
      // 响应体不是契约错误结构时保留默认信息
    }
    throw new ApiRequestError(response.status, code, message, fields);
  }
  return (await response.json()) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

/** 前端与 mock 通道共同实现的 API 客户端接口（按契约端点逐一定义）。 */
export interface ApiClient {
  listMalls(): Promise<{ malls: MallSummary[] }>;
  createMall(body: CreateMallBody): Promise<{ mall: MallSummary }>;
  getMall(id: number): Promise<{ mall: MallDetail }>;
  updateMall(id: number, body: UpdateMallBody): Promise<{ mall: MallSummary }>;

  listFloors(filter?: FloorFilter): Promise<{ floors: Floor[] }>;
  createFloor(body: CreateFloorBody): Promise<{ floor: Floor }>;
  getFloor(id: number): Promise<{ floor: FloorDetail }>;
  updateFloor(id: number, body: UpdateFloorBody): Promise<{ floor: Floor }>;

  listRobots(filter?: RobotFilter): Promise<{ robots: Robot[] }>;
  createRobot(body: CreateRobotBody): Promise<{ robot: Robot }>;
  getRobot(id: number): Promise<{ robot: RobotDetail }>;
  updateRobot(id: number, body: UpdateRobotBody): Promise<{ robot: Robot }>;

  listTasks(filter?: TaskFilter): Promise<{ tasks: Task[] }>;
  createTask(body: CreateTaskBody): Promise<{ task: Task }>;
  dispatchTask(id: number): Promise<{ task: Task }>;
  getTask(id: number): Promise<{ task: TaskDetail }>;

  reportRobotStatus(robotId: number, body: ReportRobotStatusBody): Promise<{ robot: Robot }>;
  reportRobotTaskCompletion(robotId: number): Promise<{ task: Task; robot: Robot }>;

  listMaintenanceEvents(
    filter?: MaintenanceEventFilter,
  ): Promise<{ events: MaintenanceEvent[] }>;
  createMaintenanceEvent(
    body: CreateMaintenanceEventBody,
  ): Promise<{ event: MaintenanceEvent }>;
  getMaintenanceEvent(id: number): Promise<{ event: MaintenanceEventDetail }>;
  resolveMaintenanceEvent(
    id: number,
    body: ResolveMaintenanceEventBody,
  ): Promise<{ event: MaintenanceEvent }>;

  getStats(): Promise<{ stats: Stats }>;
}

export const httpClient: ApiClient = {
  listMalls: () => request<{ malls: MallSummary[] }>('/malls'),
  createMall: (body) => post<{ mall: MallSummary }>('/malls', body),
  getMall: (id) => request<{ mall: MallDetail }>(`/malls/${id}`),
  updateMall: (id, body) => patch<{ mall: MallSummary }>(`/malls/${id}`, body),

  listFloors: (filter) => request<{ floors: Floor[] }>(`/floors${queryString({ mall_id: filter?.mall_id })}`),
  createFloor: (body) => post<{ floor: Floor }>('/floors', body),
  getFloor: (id) => request<{ floor: FloorDetail }>(`/floors/${id}`),
  updateFloor: (id, body) => patch<{ floor: Floor }>(`/floors/${id}`, body),

  listRobots: (filter) =>
    request<{ robots: Robot[] }>(
      `/robots${queryString({
        mall_id: filter?.mall_id,
        floor_id: filter?.floor_id,
        status: filter?.status,
      })}`,
    ),
  createRobot: (body) => post<{ robot: Robot }>('/robots', body),
  getRobot: (id) => request<{ robot: RobotDetail }>(`/robots/${id}`),
  updateRobot: (id, body) => patch<{ robot: Robot }>(`/robots/${id}`, body),

  listTasks: (filter) =>
    request<{ tasks: Task[] }>(
      `/tasks${queryString({
        status: filter?.status,
        floor_id: filter?.floor_id,
        mall_id: filter?.mall_id,
      })}`,
    ),
  createTask: (body) => post<{ task: Task }>('/tasks', body),
  dispatchTask: (id) => post<{ task: Task }>(`/tasks/${id}/dispatch`),
  getTask: (id) => request<{ task: TaskDetail }>(`/tasks/${id}`),

  reportRobotStatus: (robotId, body) => post<{ robot: Robot }>(`/robot-gateway/${robotId}/status`, body),
  reportRobotTaskCompletion: (robotId) =>
    post<{ task: Task; robot: Robot }>(`/robot-gateway/${robotId}/task-completion`),

  listMaintenanceEvents: (filter) =>
    request<{ events: MaintenanceEvent[] }>(
      `/maintenance-events${queryString({
        robot_id: filter?.robot_id,
        status: filter?.status,
      })}`,
    ),
  createMaintenanceEvent: (body) => post<{ event: MaintenanceEvent }>('/maintenance-events', body),
  getMaintenanceEvent: (id) => request<{ event: MaintenanceEventDetail }>(`/maintenance-events/${id}`),
  resolveMaintenanceEvent: (id, body) =>
    post<{ event: MaintenanceEvent }>(`/maintenance-events/${id}/resolve`, body),

  getStats: () => request<{ stats: Stats }>('/stats'),
};
