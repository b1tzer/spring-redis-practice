# 第5章 缓存雪崩与一致性

> 缓存三大问题的最后一环：雪崩。它比穿透、击穿影响面更大——大量 key 同时过期，缓存瞬间「失效一大片」，所有请求一起打向数据库。此外，本章还要解决一个更根本的问题：缓存和数据库的一致性怎么保证。

---

## 5.1 什么是缓存雪崩

**大量缓存在同一时间失效**，导致请求集中打到数据库。常见诱因：

| 诱因 | 说明 |
| :-- | :-- |
| 同一时刻批量写缓存 | 一批 key 同时写入，TTL 相同，将来同时过期 |
| Redis 宕机 | 缓存整体不可用，请求全部回源 |
| 缓存预热不充分 | 冷启动时缓存为空，流量集中回源 |

```mermaid
flowchart LR
    K["大量 key<br/>同一时刻过期"] --> R["海量请求"]
    R --> DB["数据库被瞬间压垮"]
```

> 雪崩 vs 击穿：击穿是「**一个**热点 key 过期」，雪崩是「**一大批** key 同时过期」。雪崩是击穿的规模化。

---

## 5.2 方案一：TTL 随机化（防同时过期）

核心思想：**给每个 key 的过期时间加一个随机偏移量**，避免它们在同一秒过期。

```java
import java.time.Duration;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class CacheService {

    private final StringRedisTemplate redis;

    public CacheService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** 写入缓存，TTL 在基准值上随机 ±20% */
    public void setWithRandomTtl(String key, String value, Duration baseTtl) {
        long baseSeconds = baseTtl.toSeconds();
        // 随机偏移：基准的 0.8 ~ 1.2 倍
        double factor = 0.8 + ThreadLocalRandom.current().nextDouble() * 0.4;
        long ttlSeconds = (long) (baseSeconds * factor);
        redis.opsForValue().set(key, value, Duration.ofSeconds(ttlSeconds));
    }
}
```

> 例如基准 30 分钟，随机后实际是 24~36 分钟，就能把「同时过期」分散到一段时间内，削峰填谷。

---

## 5.3 方案二：多级缓存 + 限流降级

当 Redis 本身宕机时，TTL 随机化也无能为力，需要更强的兜底：

| 手段 | 说明 |
| :-- | :-- |
| 本地缓存（Caffeine） | Redis 挂了，本地缓存还能顶一阵 |
| 限流 | 限制打到数据库的请求量 |
| 降级 | 数据库扛不住时，返回兜底值/默认值 |
| 熔断 | 数据库异常时快速失败，不再重复请求 |

```text
请求 → 本地缓存(Caffeine) → Redis → 数据库（限流保护）
         ↓ 都失效时
       降级返回兜底值
```

> 多级缓存的本质是「鸡蛋不放在一个篮子里」。Redis 雪崩时，本地缓存至少能挡住一部分请求。

---

## 5.4 方案三：缓存预热

在服务启动或低峰期，提前把热点数据加载到缓存，避免冷启动时流量直接冲击数据库：

```java
@Component
public class CacheWarmer implements CommandLineRunner {

    private final StringRedisTemplate redis;
    private final HotDataService hotDataService;

    public CacheWarmer(StringRedisTemplate redis, HotDataService hotDataService) {
        this.redis = redis;
        this.hotDataService = hotDataService;
    }

    @Override
    public void run(String... args) {
        // 启动时预热热点数据
        List<HotItem> hotItems = hotDataService.loadHotItems();
        for (HotItem item : hotItems) {
            redis.opsForValue().set("hot:" + item.getId(),
                    toJson(item), Duration.ofMinutes(30));
        }
    }
}
```

---

## 5.5 缓存一致性：Cache-Aside 模式

穿透、击穿、雪崩解决的是「怎么扛流量」，一致性解决的是「缓存和数据库数据对不对」。最主流的方案是 **Cache-Aside（旁路缓存）**：

| 操作 | 顺序 | 原因 |
| :-- | :-- | :-- |
| 读 | 先缓存 → 未命中查库 → 回填缓存 | 缓存优先 |
| 写 | 先更新数据库 → 再删缓存 | 避免缓存脏数据 |

```java
public void updateUser(Long id, User user) {
    // 1. 先更新数据库
    userDao.update(user);
    // 2. 再删除缓存（而不是更新缓存）
    redis.delete("user:" + id);
}
```

> 为什么「删缓存」而不是「更新缓存」？因为更新缓存可能写入并发下的旧值，而删缓存后由下次读请求重新回填，天然避免了并发写的问题。

---

## 5.6 延迟双删（解决短暂不一致）

Cache-Aside 有个小窗口：**A 更新数据库后、删缓存前，B 读到旧数据并回填了缓存**，导致缓存里是旧值。延迟双删通过在「删缓存」后**再延迟删一次**来兜底：

```java
public void updateUserWithDoubleDelete(Long id, User user) {
    userDao.update(user);          // 1. 更新数据库
    redis.delete("user:" + id);    // 2. 第一次删缓存

    // 3. 延迟一段时间后，第二次删缓存（兜底并发读的旧值回填）
    executor.schedule(() -> redis.delete("user:" + id),
            500, TimeUnit.MILLISECONDS);
}
```

| 方案 | 一致性 | 复杂度 |
| :-- | :-- | :-- |
| 先删缓存再写库 | 差（并发读回填旧值） | 低 |
| 先写库再删缓存（Cache-Aside） | 好 | 低 |
| 延迟双删 | 更好（兜底并发窗口） | 中 |
| Canal 订阅 binlog | 最好（最终一致） | 高 |

> 绝大多数业务用 **Cache-Aside + 延迟双删** 已足够。只有强一致要求的场景才考虑 Canal 等 binlog 方案。

---

## 5.7 三大问题对照表

| 问题 | 触发条件 | 核心特征 | 解法 |
| :-- | :-- | :-- | :-- |
| 穿透 | 数据不存在 | 缓存库都没有，每次查库 | 空值缓存、布隆过滤器 |
| 击穿 | 热点 key 过期 | 单点 key，瞬时高并发 | 互斥锁、逻辑过期 |
| 雪崩 | 大量 key 同时过期 | 大面积失效 | TTL 随机、多级缓存、预热 |

---

## 5.8 卷末回顾

第三卷从「Spring Cache 注解 → 集成 Redis → 穿透 → 击穿 → 雪崩与一致性」，把主站第三卷的缓存工程知识完整落地到 Spring。

下一卷进入 **分布式与高可用**：Redisson 分布式锁、主从/哨兵/集群接入——这是分布式系统的核心战场。
