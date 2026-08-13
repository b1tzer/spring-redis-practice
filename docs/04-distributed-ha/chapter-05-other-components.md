# 第5章 其他分布式组件

> 除了分布式锁，Redisson 还提供了一整套分布式组件，覆盖布隆过滤器、限流器、延迟队列等常见需求。这些组件都是「基于 Redis + Redisson 封装」，能大幅减少手写分布式逻辑的工作量。本章逐一介绍。

---

## 5.1 布隆过滤器（RBloomFilter）

布隆过滤器在第 3 卷第 3 章防穿透时已用过，这里完整介绍。

```java
import org.redisson.api.RBloomFilter;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Component;

@Component
public class BloomFilterComponent {

    private final RBloomFilter<String> bloomFilter;

    public BloomFilterComponent(RedissonClient redissonClient) {
        this.bloomFilter = redissonClient.getBloomFilter("product:bloom");
        this.bloomFilter.tryInit(1_000_000L, 0.01);  // 预计 100 万，误判率 1%
    }

    public void add(String value) {
        bloomFilter.add(value);
    }

    public boolean mightExist(String value) {
        return bloomFilter.contains(value);
    }
}
```

**关键参数**：

| 参数 | 说明 |
| :-- | :-- |
| `expectedInsertions`（100 万） | 预计元素数量，决定内存大小 |
| `falseProbability`（0.01） | 误判率，越小越占内存 |

> 注意：布隆过滤器只能加、不能删。如果业务需要删除元素，考虑 Redisson 的布隆过滤器变体或用 Cuckoo 过滤器。

---

## 5.2 限流器（RRateLimiter）

Redisson 基于 Redis 实现了分布式限流器，支持多种限流算法：

```java
import org.redisson.api.RRateLimiter;
import org.redisson.api.RateIntervalUnit;
import org.redisson.api.RateType;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Component;

@Component
public class RateLimiterComponent {

    private final RedissonClient redissonClient;

    public RateLimiterComponent(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }

    public void demo() {
        RRateLimiter limiter = redissonClient.getRateLimiter("rate:user:1");
        // 初始化：每 1 秒允许 10 个请求（令牌桶）
        limiter.trySetRate(RateType.OVERALL, 10, 1, RateIntervalUnit.SECONDS);

        // 尝试获取令牌
        if (limiter.tryAcquire()) {
            // 放行
        } else {
            // 限流
        }
    }
}
```

**限流算法类型**：

| RateType | 说明 | 适用 |
| :-- | :-- | :-- |
| `OVERALL` | 全局共享限流 | 总流量控制 |
| `PER_CLIENT` | 每个客户端独立限流 | 单用户限流 |

> 相比第 5 卷实战项目里手写的滑动窗口，Redisson 的 `RRateLimiter` 更省事，但也要理解它底层是「令牌桶/漏桶」算法，精度和手写 ZSet 滑动窗口略有差异。

---

## 5.3 延迟队列（RDelayedQueue）

Redisson 的延迟队列基于 ZSet 实现，可以「让任务延迟一段时间后才被消费」：

```java
import org.redisson.api.RBlockingQueue;
import org.redisson.api.RDelayedQueue;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Component;

@Component
public class DelayedQueueComponent {

    private final RBlockingQueue<String> blockingQueue;
    private final RDelayedQueue<String> delayedQueue;

    public DelayedQueueComponent(RedissonClient redissonClient) {
        this.blockingQueue = redissonClient.getBlockingQueue("task:queue");
        this.delayedQueue = redissonClient.getDelayedQueue(blockingQueue);
    }

    /** 提交一个延迟任务 */
    public void submit(String task, long delaySeconds) {
        delayedQueue.offer(task, delaySeconds, java.util.concurrent.TimeUnit.SECONDS);
    }

    /** 消费任务（到期后自动进入阻塞队列） */
    public void consume() throws InterruptedException {
        String task = blockingQueue.take();   // 阻塞等待到期任务
        // 处理任务
    }
}
```

**原理**：

```text
延迟任务 → 存入 ZSet（score = 到期时间戳）
         → 定时检查，到期的移入阻塞队列
         → 消费者从阻塞队列 take()
```

**典型场景**：订单超时关闭、延迟消息推送、定时提醒。

---

## 5.4 其他常用组件速查

Redisson 还提供了大量分布式组件，这里列一个速查表：

| 组件 | 接口 | 用途 |
| :-- | :-- | :-- |
| 布隆过滤器 | `RBloomFilter` | 防穿透、去重 |
| 限流器 | `RRateLimiter` | 接口限流 |
| 延迟队列 | `RDelayedQueue` | 延迟任务 |
| 分布式集合 | `RMap` / `RList` / `RSet` | 分布式数据结构 |
| 分布式计数 | `RAtomicLong` | 原子计数器 |
| 分布式信号量 | `RSemaphore` | 并发控制 |
| 分布式读写锁 | `RReadWriteLock` | 读写分离锁 |

> Redisson 的定位就是「把 Redis 变成分布式 Java 数据结构仓库」。需要什么分布式能力，先查 Redisson 有没有现成的，避免重复造轮子。

---

## 5.5 选型心法

| 需求 | 首选 |
| :-- | :-- |
| 分布式锁 | `RLock` |
| 防穿透 | `RBloomFilter` |
| 接口限流 | `RRateLimiter` |
| 延迟任务 | `RDelayedQueue` |
| 原子计数 | `RAtomicLong` |

> 核心原则：**能用 Redisson 现成组件就别手写**。手写分布式组件容易踩并发、原子性、续期等坑，Redisson 已经帮你踩过了。

---

## 5.6 卷末回顾

第四卷从「Redisson 分布式锁 → 锁的坑 → 哨兵 → 集群 → 其他分布式组件」，覆盖了主站第四卷「高可用与分布式」的 Spring 落地。

下一卷是最后的**第五卷 实战项目**：用 Spring Boot 完整实现「缓存接口 + 分布式锁 + 限流器」三个场景，把全书知识串成一个可运行的项目。
