# 第4章 超时与重试

> 网络调用永远可能失败：连接建立慢、命令执行超时、节点故障……本章把 Spring 下 Redis 的「超时」和「重试」两件事拆开讲清楚。超时是「等多久算失败」，重试是「失败后要不要再来一次」，二者配错会导致服务雪崩或数据不一致。

---

## 4.1 三种「超时」别搞混

Spring 下 Redis 涉及的超时不止一个，含义完全不同：

| 超时 | 配置项 | 含义 |
| :-- | :-- | :-- |
| 连接超时 | `connect-timeout` | 建立 TCP 连接的最大等待时间 |
| 命令超时 | `timeout` | 单条命令执行的最大等待时间 |
| 获取连接超时 | `pool.max-wait` | 从连接池借连接的最大等待时间 |

```yaml
spring:
  data:
    redis:
      connect-timeout: 2s   # 连接超时
      timeout: 3s           # 命令超时
      lettuce:
        pool:
          max-wait: 2s      # 获取连接超时
```

> 最容易混的是 `connect-timeout` 和 `timeout`：前者只管「连上」这一步，后者管「连上后发命令等结果」这一步。线上「Redis 慢」通常调的是 `timeout`。

---

## 4.2 超时设多大合适

| 场景 | 建议值 | 理由 |
| :-- | :-- | :-- |
| `connect-timeout` | 1~2s | 连接建立应该很快，超时说明网络或端口有问题 |
| `timeout` | 3~5s | Redis 命令通常毫秒级，3s 已经算「很慢」 |
| `pool.max-wait` | 1~2s | 拿不到连接说明池不够或 Redis 阻塞，别让线程无限等 |

> 反直觉的一点：**超时不是越大越好**。超时设太长，Redis 一旦故障，调用方会大量线程长时间挂起，拖垮整个服务（比「快速失败」危害大得多）。宁可超时短一点、快速失败，配合降级。

---

## 4.3 为什么不能盲目重试

很多人一看到超时就「重试一下」，这是危险的。重试必须区分**命令是否幂等**：

| 命令类型 | 幂等性 | 能否重试 |
| :-- | :-- | :-- |
| 读命令（GET/HGET） | ✅ 幂等 | 可以安全重试 |
| 写命令-幂等（SET/DEL） | ✅ 幂等 | 可以重试 |
| 写命令-非幂等（INCR/LPOP） | ❌ 非幂等 | **不能盲目重试** |

**关键风险**：`INCR` 这类命令如果「已执行但响应丢失」，重试会导致**重复计数**。例如：

```text
客户端发 INCR views → 服务端执行了 → 响应在网络中丢失
客户端超时 → 重试 INCR views → 又 +1
结果：一次点击被算了两次
```

> 所以重试的黄金法则：**读命令和幂等写命令可重试，非幂等写命令要么不重试，要么用 Lua 脚本 / 幂等 Key 设计来保证重试安全**。

---

## 4.4 Spring 下的重试方案

Spring Data Redis 本身不提供自动重试，需要自己实现。常见两种方式：

### 方式一：Spring Retry 注解（简单场景）

```java
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;

@Service
public class CacheService {

    private final StringRedisTemplate redis;

    public CacheService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Retryable(
        value = { RedisConnectionFailureException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 100, multiplier = 2)
    )
    public String getWithRetry(String key) {
        // 读命令，幂等，可安全重试
        return redis.opsForValue().get(key);
    }
}
```

> 注意：只对**读命令或幂等写命令**加 `@Retryable`，不要对 `INCR`、`LPOP` 等非幂等命令无脑重试。

### 方式二：手动重试（更可控）

```java
public String getWithManualRetry(String key, int maxRetry) {
    for (int i = 0; i < maxRetry; i++) {
        try {
            return redis.opsForValue().get(key);
        } catch (RedisConnectionFailureException e) {
            if (i == maxRetry - 1) throw e;   // 最后一次仍失败则抛出
            sleep(100L << i);                 // 指数退避
        }
    }
    return null;
}
```

---

## 4.5 故障转移场景下的重试

主从/哨兵架构下，主节点故障会触发故障转移。切换期间命令会短暂失败，此时重试才有意义：

| 场景 | 重试策略 |
| :-- | :-- |
| 主从切换瞬间 | 读命令重试（等哨兵完成切换） |
| 集群 MOVED/ASK 重定向 | 客户端自动处理，无需手动重试 |
| 网络抖动 | 幂等命令重试，非幂等命令慎用 |

> Lettuce 对集群的 MOVED/ASK 重定向是**自动**的，开发者无需关心；但主从切换的短暂不可用，往往需要业务层做重试或降级兜底。

---

## 4.6 本章小结

| 要点 | 说明 |
| :-- | :-- |
| 三种超时 | `connect-timeout` / `timeout` / `pool.max-wait` 含义不同 |
| 超时宜短 | 快速失败优于长时间挂起 |
| 重试前提 | 只有幂等命令才能安全重试 |
| 非幂等命令 | INCR/LPOP 等重试会导致重复，需幂等设计 |
| 实现方式 | Spring Retry 注解 或 手动指数退避 |

> 记住两条：**超时设短、快速失败；重试只针对幂等命令**。这两条守住了，Redis 故障才不会从「局部超时」演变成「全局雪崩」。
