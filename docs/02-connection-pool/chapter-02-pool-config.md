# 第2章 连接池配置

> 第 1 章讲了 Lettuce 和 Jedis 的本质差异，本章落到配置层面：二者连接池的机制完全不同，Lettuce 默认「共享连接」甚至可以不配池，而 Jedis 必须配池。理解各自参数的含义，才能在生产环境调出合理的连接数。

---

## 2.1 两种连接模型下的「池」含义不同

| 客户端 | 连接模型 | 连接池作用 |
| :-- | :-- | :-- |
| Lettuce | 共享连接（多路复用） | 池是「可选优化」，默认共享少量连接 |
| Jedis | 每线程独占连接 | 池是「必需」，管理连接借还与复用 |

这个差异带来的后果是：**Jedis 的连接数必须和并发线程数匹配，而 Lettuce 的连接数基本恒定**。因此同样的 QPS，Jedis 可能开几百个连接，Lettuce 只需几个。

---

## 2.2 Lettuce 连接池配置

Spring Boot 下 Lettuce 连接池参数在 `spring.data.redis.lettuce.pool.*`：

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      timeout: 3s
      lettuce:
        pool:
          max-active: 8      # 最大活跃连接数
          max-idle: 8        # 最大空闲连接数
          min-idle: 0        # 最小空闲连接数
          max-wait: -1ms     # 获取连接最大等待时间，-1 表示无限等待
          time-between-eviction-runs: 10s   # 空闲连接检查周期
```

**关键点**：

1. **需要引入 commons-pool2**：Lettuce 默认不依赖连接池，配了 `pool` 却不引入 `commons-pool2` 会报错。Maven 需加：

```xml
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

2. **`max-active` 不宜设太大**：Lettuce 是共享连接模型，8~16 个连接通常足够扛住很高并发。设太大反而浪费 Redis 端资源（Redis 单线程，连接太多也处理不过来）。

3. **`max-wait: -1` 的坑**：设为 -1 表示无限等待，如果连接都被占用且长时间不释放，线程会一直阻塞，可能拖垮整个服务。生产建议设一个有限值（如 `2s`），配合超时告警。

---

## 2.3 Jedis 连接池配置

Jedis 的连接池参数在 `spring.data.redis.jedis.pool.*`，语义和传统的 `JedisPoolConfig` 一致：

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      jedis:
        pool:
          max-active: 200     # 最大活跃连接数
          max-idle: 20        # 最大空闲连接数
          min-idle: 5         # 最小空闲连接数
          max-wait: 2s        # 获取连接最大等待时间
```

**Jedis 的 `max-active` 要重点评估**：

- Jedis 是每线程独占连接，`max-active` 必须 **≥ 业务并发线程数**；
- 设小了，高并发时线程拿不到连接，在 `max-wait` 超时后抛异常；
- 设大了，Redis 端连接数暴涨，可能触发 `maxclients` 上限。

> 经验公式（Jedis）：`max-active ≈ 应用实例数 × 单实例并发线程数`，再留 20% 余量。例如 10 个实例、每实例 20 并发，则 `max-active ≈ 10 × 20 × 1.2 = 240`。

---

## 2.4 Redis 服务端的连接上限

无论客户端怎么配，最终受 Redis 服务端 `maxclients` 限制：

```bash
redis-cli CONFIG GET maxclients      # 查看最大连接数（默认 10000）
redis-cli CONFIG SET maxclients 20000 # 动态调整
```

```bash
redis-cli CLIENT LIST | wc -l        # 统计当前连接数
```

**连接数失控的典型原因**：

| 原因 | 表现 | 对策 |
| :-- | :-- | :-- |
| Jedis 池过大 | 连接数随实例数线性增长 | 控制 `max-active`，或迁 Lettuce |
| 连接未归还 | 连接泄漏，连接数只增不减 | try-with-resources 确保归还 |
| 短连接 | 频繁建连断连 | 用连接池复用 + 长连接 |

---

## 2.5 连接池参数速查

| 参数 | 含义 | Lettuce 建议 | Jedis 建议 |
| :-- | :-- | :-- | :-- |
| `max-active` | 最大活跃连接 | 8~16 | = 并发线程数 × 1.2 |
| `max-idle` | 最大空闲连接 | 与 max-active 一致 | 适中即可 |
| `min-idle` | 最小空闲连接 | 0 | 5 左右，避免冷启动建连 |
| `max-wait` | 获取连接等待上限 | 有限值（如 2s） | 有限值（如 2s） |

---

## 2.6 本章小结

| 要点 | 说明 |
| :-- | :-- |
| Lettuce | 共享连接，池可选，需引入 commons-pool2，连接数设 8~16 即可 |
| Jedis | 每线程独占连接，池必需，`max-active` 要和并发匹配 |
| 服务端 | 最终受 `maxclients` 限制，注意连接泄漏 |
| 共性 | `max-wait` 别设 -1（无限等待），建议有限值 |

> 连接池的黄金法则：**Lettuce 靠「少而共享」，Jedis 靠「够而不滥」**。搞清你用的是哪个客户端，再决定连接数怎么配。
