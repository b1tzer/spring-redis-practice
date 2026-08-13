# 第5章 持久化与配置

> 主站第二卷用大量篇幅讲 RDB、AOF 的原理，本章不重复原理，而是回答：这些持久化配置在 Spring 应用场景下该怎么落地？特别是「缓存场景」和「持久化场景」对配置的要求完全不同，配错轻则浪费性能，重则丢数据。

---

## 5.1 先定位你的 Redis 角色

Spring 应用里的 Redis 通常扮演两种角色，配置策略截然不同：

| 角色 | 数据重要程度 | 持久化要求 |
| :-- | :-- | :-- |
| 纯缓存 | 低（丢了可回源重建） | 可关闭持久化，追求极致性能 |
| 数据存储 | 高（丢了无法恢复） | 必须开持久化，牺牲部分性能 |

> 判断标准就一句：**Redis 里的数据丢了，能不能从别的数据源恢复？** 能恢复就按「纯缓存」配，不能就按「数据存储」配。

---

## 5.2 场景一：纯缓存（推荐关闭/弱持久化）

缓存数据丢了能回源数据库重建，此时持久化纯属浪费，可以关闭或弱化：

```bash
# 关闭 RDB 快照
redis-cli CONFIG SET save ""

# 关闭 AOF
redis-cli CONFIG SET appendonly no
```

好处：

1. **省 IO**：不写磁盘，Redis 纯粹在内存里跑，性能最好；
2. **避免 fork 停顿**：不 fork 子进程做快照，无周期性卡顿；
3. **省磁盘空间**：不产生 RDB/AOF 文件。

> 但如果缓存数据量大、回源成本高（如大促预热的热点数据），可以保留 RDB 快照做「冷启动预热」，避免缓存击穿。

---

## 5.3 场景二：数据存储（必须开持久化）

当 Redis 承担了分布式锁、计数器、排行榜等「不可重建」的数据，就必须开持久化，且优先 AOF：

```bash
# 开启 AOF，everysec 刷盘（性能与安全平衡点）
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec

# 保留 RDB 作为冷备 + 故障恢复
redis-cli CONFIG SET save "900 1 300 10 60 10000"
```

| 配置 | 值 | 说明 |
| :-- | :-- | :-- |
| `appendonly` | yes | 开启 AOF |
| `appendfsync` | everysec | 每秒刷盘，最多丢 1 秒数据 |
| `save` | 900 1 等 | RDB 快照，作为冷备 |

> `appendfsync` 三档对比：`always`（每条刷盘，最安全最慢）、`everysec`（每秒刷盘，推荐）、`no`（交给 OS，最不安全）。生产默认 `everysec`。

---

## 5.4 混合持久化（Redis 5.0+）

Redis 5.0 引入混合持久化：AOF 重写时，先写一份 RDB 快照，再追加增量 AOF，兼顾「恢复快」和「丢数据少」：

```bash
redis-cli CONFIG SET aof-use-rdb-preamble yes
```

| 方案 | 恢复速度 | 丢数据风险 | 适用 |
| :-- | :-- | :-- | :-- |
| 纯 RDB | 快 | 最多丢最后一次快照后的数据 | 冷备 |
| 纯 AOF | 慢 | 少（everysec 丢 1 秒） | 数据存储 |
| 混合 | 快 | 少 | **推荐**（数据存储场景） |

> 生产数据存储场景，最佳实践是 **AOF（everysec）+ RDB 冷备 + 混合持久化**，三管齐下。

---

## 5.5 Spring 应用侧该做什么

持久化是 Redis 服务端的事，但 Spring 应用侧有两点要配合：

1. **别把「配置」写死在应用里**：持久化参数用运维手段（配置管理、`CONFIG SET`、redis.conf）管理，不要试图在 Spring 代码里动态改 Redis 配置——职责分离。

2. **监控持久化健康度**：在监控里关注这几个指标，持久化出问题会导致数据丢失：

```bash
redis-cli INFO persistence
# rdb_last_bgsave_status        RDB 最近一次快照是否成功
# aof_last_write_status         AOF 最近一次写入是否成功
# aof_last_bgrewrite_status     AOF 重写是否成功
```

| 指标 | 告警条件 |
| :-- | :-- |
| `rdb_last_bgsave_status` | != ok |
| `aof_last_write_status` | != ok |
| `aof_last_bgrewrite_status` | != ok |

---

## 5.6 配置速查表

| 场景 | RDB | AOF | 混合 | 说明 |
| :-- | :-- | :-- | :-- | :-- |
| 纯缓存 | 关 | 关 | 关 | 极致性能 |
| 缓存+预热 | 开 | 关 | — | 快照用于冷启动 |
| 数据存储 | 开（冷备） | 开（everysec） | 开 | 最安全 |
| 强一致 | 开 | `always` | 开 | 性能换安全 |

---

## 5.7 本章小结

| 要点 | 说明 |
| :-- | :-- |
| 先定位角色 | 纯缓存 vs 数据存储，决定持久化策略 |
| 纯缓存 | 可关持久化，极致性能 |
| 数据存储 | AOF everysec + RDB 冷备 + 混合持久化 |
| 职责分离 | 持久化配置归服务端，应用侧只做监控 |
| 健康监控 | 关注 bgsave/aof 的 status 指标 |

> 持久化的核心不是「开不开」，而是「**你的 Redis 数据丢了能不能接受**」。先回答这个问题，配置自然清晰。

---

## 5.8 卷末回顾

第二卷从「客户端选型 → 连接池 → 线程模型 → 超时重试 → 持久化」走完，回答了「Spring 下如何把 Redis 用稳」。

下一卷进入 **Spring Cache**，把缓存穿透、击穿、雪崩这些主站第三卷讲的工程问题，用 Spring 的 `@Cacheable` 系列注解落地。
