# 掼蛋记分器 3 (Guandan Scorer 3)

> 掼蛋是一款流行于江苏、安徽地区的扑克牌游戏，这款应用用于记录和管理掼蛋游戏的积分。
> Guandan is a popular Chinese card game originating from Jiangsu and Anhui. This app records and manages Guandan game scores.

## 功能特点 / Features

| 中文 | English |
|------|---------|
| 玩家管理 — 添加/删除玩家 | Player management — add/remove players |
| 记分系统 — 支持 +3/+2/+1 与 -3/-2/-1 组合 | Scoring system — supports +3/+2/+1 and -3/-2/-1 combos |
| 积分榜 — 今日积分 + 本月累计 | Scoreboard — today + monthly cumulative |
| 日结 — 跨日多次日结 | Daily settlement — multiple times per day |
| 月结 — 跨月多次月结 | Monthly settlement — multiple times per month |
| 历史记录 — 三区展示 (current / unsettled / monthly) | History — 3 sections (current / unsettled / monthly) |
| 运行时配置 — 通过 `/api/config` 端点热加载 | Runtime config — hot-reload via `/api/config` |
| 多主题 — zen / modern / simple 三套主题 | Multi-theme — zen / modern / simple |
| 字体 — LXGW WenKai Screen 行楷 | Font — LXGW WenKai Screen |
| Pino 结构化日志 — 可配日志级别 | Pino structured logging — configurable level |
| 服务端 7 层验证 — 防御性数据校验 | 7-layer server-side validation |
| 4 字段 dedup — `(date, round, player_id, daily_settlement_id)` | 4-field dedup key |

## 技术栈 / Tech Stack

- **前端 / Frontend**: React 18 + Vite 6
- **后端 / Backend**: Express 4 + sql.js
- **数据库 / Database**: SQLite (via sql.js)
- **日志 / Logging**: Pino
- **HTTP 客户端 / HTTP client**: Axios

## 项目结构 / Project Structure

```
guandan-scorer3/
├── src/
│   ├── components/         # React 组件 (6 个页面)
│   │   ├── Home.jsx
│   │   ├── Score.jsx
│   │   ├── History.jsx
│   │   ├── DailySettlement.jsx
│   │   ├── MonthlySettlement.jsx
│   │   └── PlayerManagement.jsx
│   ├── context/            # 全局状态管理
│   │   └── GameContext.jsx
│   ├── api/                # API 调用封装
│   │   └── index.js
│   ├── config.js           # 运行时配置加载
│   ├── logger.js           # Pino logger wrapper
│   ├── server.js           # Express 入口
│   └── database.js         # sql.js 初始化
├── config/                 # 配置文件
│   └── default.json
├── data/                   # 数据库目录
│   ├── guandan.db
│   └── guandan.db.backup.YYYYMMDD_HHMMSS
├── logs/                   # 服务端日志
├── dist/                   # Vite 构建输出
├── Dockerfile
├── docker-compose.yml
├── vite.config.js
└── package.json
```

## 记分规则 / Score Rules

服务端在 `/api/current-game/submit` 和 `/api/records` 强制执行以下 7 层验证。
The server enforces 7 layers of validation on `/api/current-game/submit` and `/api/records`.

| # | 规则 / Rule | 失败提示 / Error message |
|---|------------|--------------------------|
| 1 | `records` 必须是数组,非空 | `没有记分记录` |
| 2 | 记录数 **正好 4 条** (不多不少) | `仅限4位玩家记分` |
| 3 | 每条含 `player_id` 和 number 类型 `score` | `记分数据格式错误` |
| 4 | 4 个 `player_id` 必须互不重复 | `记分包含重复玩家 player_id=X` |
| 5 | combo ∈ { [+3,+3,-3,-3], [+2,+2,-2,-2], [+1,+1,-1,-1] } | `记分组合无效:[…],必须是 [+3,+3,-3,-3] / [+2,+2,-2,-2] / [+1,+1,-1,-1]` |
| 6 | 4 个 score 之和 = 0 (combo 隐含,二次防御) | `记分总和必须为 0,收到 N` |
| 7 | 每个 `player_id` 必须在 `players` 表存在 | `玩家 id=X 不存在` |
| 8 | Dedup: (date, round, player_id, daily_settlement_id IS NULL) 唯一 | `本局 (日期 第N局) 玩家 X 已经记分 (id=Y, score=Z),不能重复提交` |

## 配置 / Configuration

配置文件位于 `config/default.json`,可通过以下方式覆盖:
Configuration lives in `config/default.json`. Override via:

- 用户配置文件: `config/config.json` (优先级高于 default)
- 环境变量 `CONFIG_PATH`: 自定义路径

```json
{
  "admin": true,
  "pollInterval": 600000,
  "logLevel": "info"
}
```

| 字段 / Field | 含义 / Meaning | 默认 / Default |
|--------------|----------------|----------------|
| `admin` | 启用管理员功能 (重置、玩家管理) | `true` |
| `pollInterval` | App 拉取 `/api/config` 间隔 (ms) | `600000` (10 min) |
| `logLevel` | Pino 日志级别 (trace/debug/info/warn/error/fatal) | `info` |

配置文件变更后,服务会在 1s 内热重载。Config file changes hot-reload within 1s.

## Polling 间隔 / Polling Intervals

| 位置 / Location | 间隔 / Interval | 用途 / Purpose |
|-----------------|-----------------|----------------|
| `src/components/Score.jsx` (via GameContext) | **5s** | Score 页拉取 `loadData()` (含 current game + scores) |
| `src/components/Home.jsx` | **8s** | Home 页拉取 `loadData()` |
| `src/App.jsx` | 10 min | 拉取 `/api/config` 监听配置变更 |

> 设计权衡: 降低 polling 频率以减少 sql.js 写放大对手机端的压力;Score 页保持 5s 以提供较流畅的记分体验。Trade-off: lower frequency reduces sql.js write amplification pressure on phones; Score page keeps 5s for fluid scoring experience.

## API 端点 / API Endpoints

| Method | Path | 用途 / Purpose |
|--------|------|----------------|
| GET | `/api/config` | 运行时配置 / Runtime config |
| GET | `/api/players` | 玩家列表 / List players |
| POST | `/api/players` | 添加玩家 / Add player |
| PUT | `/api/players/:id` | 修改玩家名 / Rename player |
| DELETE | `/api/players/:id` | 删除玩家 (级联删除积分记录) / Delete player |
| GET | `/api/scores` | 今日+本月积分榜 / Today + month scoreboard |
| GET | `/api/records?date=YYYY-MM-DD` | 指定日期的记分 / Records for date |
| POST | `/api/records` | 批量插入记分 (admin 路径) / Bulk insert |
| GET | `/api/current-game` | 当前进行中的游戏 / Current game |
| POST | `/api/current-game` | 保存当前游戏状态 / Save game state |
| POST | `/api/current-game/submit` | 提交本局记分 / Submit round scores |
| POST | `/api/current-game/reset` | 重置当前游戏 / Reset current game |
| GET | `/api/daily-settlement?date=...` | 查询日结 / Get daily settlement |
| POST | `/api/daily-settlement` | 执行日结 / Execute daily settlement |
| GET | `/api/daily-settlement/:key/records` | 某日结下的所有记录 / Records under settlement |
| GET | `/api/check-daily-settled?date=...` | 检查某天是否已日结 / Check if settled |
| GET | `/api/monthly-settlement?month=YYYY-MM` | 查询月结 / Get monthly settlement |
| POST | `/api/monthly-settlement` | 执行月结 / Execute monthly settlement |
| GET | `/api/history` | 历史 (月结 + 日结 + 当前未日结) / History |
| GET | `/api/daily-records?month=YYYY-MM` | 当月所有日记录 / All daily records for month |
| POST | `/api/reset` | 重置所有数据 (admin, 需密码) / Reset all (admin) |

## 主题与字体 / Themes & Fonts

- **3 套主题**: `zen` (默认) / `modern` / `simple` — 写入 `localStorage` 的 `theme` 键
- **字体**: LXGW WenKai Screen 行楷,从 `cdn.staticfile.org` 加载
- **Body font-size**: 13px

## 本地开发 / Local Development

```bash
# 安装依赖 / Install dependencies
npm install

# 启动后端 (端口 5173) / Start backend on :5173
APIPORT=5173 node src/server.js

# 另开终端,启动前端 (端口 3000) / Start frontend on :3000
npm run dev
```

Vite dev server 通过 `/api` proxy 转发到 `http://localhost:5173`。
Vite proxies `/api` to `http://localhost:5173`.

## Docker 部署 / Docker Deployment

```bash
docker-compose up -d --build
```

- 端口映射: `3000:3000`
- 卷挂载: `./data`, `./logs`, `./config`
- 时区: `Pacific/Auckland`
- 容器内执行: `node src/server.js`

## 环境变量 / Environment Variables

| 变量 / Variable | 用途 / Purpose | 默认 / Default |
|------------------|----------------|----------------|
| `APIPORT` | 后端监听端口 / Backend port | `5173` |
| `CONFIG_PATH` | 配置文件路径 / Config file path | `config/default.json` |
| `TZ` | 容器时区 / Container timezone | `Pacific/Auckland` |
| `NODE_ENV` | 运行环境 / Runtime mode | (无) |

## 数据库 / Database

详见 `data/README.md`。主表 `score_records` 包含 8 列,记分数据通过 `daily_settlement_id` 和 `monthly_settlement_id` 关联到日结/月结。
See `data/README.md` for full schema. `score_records` has 8 columns and is linked to settlements via `daily_settlement_id` / `monthly_settlement_id`.

## 许可证 / License

MIT
