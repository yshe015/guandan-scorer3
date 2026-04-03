# 掼蛋记分器 3 (Guandan Scorer 3)

掼蛋是一款流行于江苏、安徽地区的扑克牌游戏，这款应用用于记录和管理掼蛋游戏的积分。

## 功能特点

- **玩家管理** - 添加/删除玩家
- **记分系统** - 支持 +3/+2/+1 与 -3/-2/-1 积分组合
- **积分榜** - 显示今日积分和本月累计积分
- **日结** - 支持跨日多次日结
- **月结** - 支持跨月多次月结
- **历史记录** - 带 Expander 展开功能，查看历史数据

## 技术栈

- **前端**: React + Vite
- **后端**: Express.js + sql.js
- **数据库**: SQLite

## 项目结构

```
guandan-scorer3/
├── src/
│   ├── components/     # React 组件
│   ├── context/       # 全局状态管理
│   ├── api/           # API 调用
│   ├── server.js      # Express 服务
│   └── database.js    # 数据库初始化
├── dist/               # 构建输出
├── data/               # 数据库文件
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 开发

### 本地开发

```bash
# 安装依赖
npm install

# 启动后端
node src/server.js

# 启动前端开发服务器
npm run dev
```

### Docker 部署

```bash
docker-compose up -d --build
```

## API 端口

- **3000**: 主服务端口

## 许可证

MIT
