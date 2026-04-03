# 数据库目录

此目录包含掼蛋记分器 3 的 SQLite 数据库文件。

## 文件说明

- `guandan.db` - 主数据库文件

## 数据库表结构

### players 表
- id: 玩家 ID
- name: 玩家名称
- created_at: 创建时间

### score_records 表
- id: 记录 ID
- date: 日期
- month: 月份
- round: 局数
- player_id: 玩家 ID
- score: 积分
- daily_settlement_id: 日结标识符
- monthly_settlement_id: 月结标识符

### daily_settlement 表
- id: 日结 ID
- date: 日期
- month: 月份
- data: 日结数据 (JSON)
- settled_at: 日结时间
- settlement_key: 唯一标识符 (格式: YYYYMMDDRJ序号)

### monthly_settlement 表
- id: 月结 ID
- month: 月份
- data: 月结数据 (JSON)
- settled_at: 月结时间
- settlement_key: 唯一标识符 (格式: YYYYMMyj序号)

### current_game 表
- id: 游戏 ID
- date: 日期
- round: 当前局数
- selected_players: 已选玩家 (JSON)
- scores: 当前分数 (JSON)
- submitted: 是否已提交
- submitted_at: 提交时间
