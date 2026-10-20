-- 001: 初始 schema —— 五张业务表（malls / floors / robots / tasks / maintenance_events）
-- 约定：id 为整数自增主键；时间戳为 ISO 8601 UTC 字符串；服务端领域层负责状态机守卫，
-- 本层的 CHECK/UNIQUE 约束作为最后一致性防线（错误码友好的校验在服务层完成）。

CREATE TABLE malls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  created_at TEXT NOT NULL
);

CREATE TABLE floors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mall_id INTEGER NOT NULL REFERENCES malls (id),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_floors_mall ON floors (mall_id);

CREATE TABLE robots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  floor_id INTEGER NOT NULL REFERENCES floors (id),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  code TEXT NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 50),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'executing', 'fault')),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_robots_code ON robots (code);
CREATE INDEX idx_robots_floor ON robots (floor_id);
CREATE INDEX idx_robots_status ON robots (status);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  floor_id INTEGER NOT NULL REFERENCES floors (id),
  robot_id INTEGER REFERENCES robots (id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed')),
  created_at TEXT NOT NULL,
  dispatched_at TEXT,
  completed_at TEXT
);
CREATE INDEX idx_tasks_floor ON tasks (floor_id);
CREATE INDEX idx_tasks_robot ON tasks (robot_id);
CREATE INDEX idx_tasks_status ON tasks (status);

CREATE TABLE maintenance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  robot_id INTEGER NOT NULL REFERENCES robots (id),
  type TEXT NOT NULL CHECK (type IN ('fault', 'maintenance')),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX idx_maintenance_robot ON maintenance_events (robot_id);
CREATE INDEX idx_maintenance_status ON maintenance_events (status);
