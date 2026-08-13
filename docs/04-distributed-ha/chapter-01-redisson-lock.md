# 第1章 Redisson 分布式锁

> 主站第四卷讲了分布式锁的原理（`SET NX PX` + Lua 释放），本章直接用 Redisson 落地。Redisson 把分布式锁的「加锁、续期、可重入、释放」全部封装好，是 Java 生态最主流的分布式锁实现，没有之一。

---

## 1.1 为什么用 Redisson 而不是手写

手写分布式锁要处理一堆棘手问题：锁超时怎么办、业务没执行完锁过期了怎么办、怎么防止误删别人的锁、怎么支持可重入……Redisson 把这些全部解决，一行 `lock()` 搞定。

| 能力 | 手写 | Redisson |
| :-- | :-- | :-- |
| 加锁/释放 | 手动 `SET NX PX` + Lua | `lock()` / `unlock()` |
| 锁续期 | 需自己写定时器 | 看门狗自动续期 |
| 可重入 | 需自己计数 | 内置支持 |
| 误删防护 | 需自己存 token 校验 | 内置校验 |
| 公平锁/读写锁 | 复杂 | 开箱即用 |

---

## 1.2 引入依赖

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.27.0</version>
</dependency>
```

基础配置（`application.yml`）：

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
```

> `redisson-spring-boot-starter` 会自动装配 `RedissonClient`，复用 Spring Boot 的 Redis 连接配置，无需手动写 `RedissonClient` Bean（除非需要集群/哨兵等复杂配置）。

---

## 1.3 基本用法：加锁与释放

```java
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class LockService {

    private final RedissonClient redissonClient;

    public LockService(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }

    public void deductStock() {
        RLock lock = redissonClient.getLock("lock:stock:100");

        try {
            // 尝试加锁，最多等 3 秒，锁自动过期 10 秒
            boolean locked = lock.tryLock(3, 10, TimeUnit.SECONDS);
            if (!locked) {
                throw new RuntimeException("获取锁失败");
            }
            // 临界区：执行业务
            doBusiness();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            // 释放锁（必须判断是否由当前线程持有）
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    private void doBusiness() {
        // 扣减库存等业务逻辑
    }
}
```

**参数解释**：

| 参数 | 说明 |
| :-- | :-- |
| `waitTime`（3 秒） | 尝试获取锁的最大等待时间，超时返回 false |
| `leaseTime`（10 秒） | 锁的持有时间，到期自动释放 |
| `lock()` | 无参版本，阻塞直到拿到锁 |

---

## 1.4 看门狗（Watchdog）自动续期

这是 Redisson 最重要的特性。看门狗的机制是：

> **如果加锁时没有指定 `leaseTime`，Redisson 会默认给锁 30 秒有效期，并启动一个看门狗线程，每隔 10 秒检查：如果业务还没执行完，就自动把锁「续命」到 30 秒。**

```java
// 不指定 leaseTime，触发看门狗自动续期
lock.lock();   // 业务执行多久，锁就自动续多久，不用担心锁提前过期
```

```text
lock() → 默认 leaseTime = 30s → 看门狗每 10s 续期到 30s
         └── 业务执行完 unlock() → 看门狗停止，锁释放
```

**关键对比**：

| 用法 | leaseTime | 看门狗 | 适用 |
| :-- | :-- | :-- | :-- |
| `lock()` | 默认 30s | ✅ 自动续期 | 业务执行时间不确定 |
| `lock(10, SECONDS)` | 指定 10s | ❌ 不续期 | 明确知道业务在 10s 内完成 |

> 新手常见坑：指定了 `leaseTime` 后看门狗就不工作了。如果业务执行超过 `leaseTime`，锁会被自动释放，导致并发问题。**业务耗时不确定时，用不指定 leaseTime 的 `lock()`**。

---

## 1.5 可重入锁

Redisson 的 `RLock` 天然可重入：同一个线程可以多次获取同一把锁，每次获取内部计数 +1，释放时计数 -1，减到 0 才真正释放。

```java
public void outer() {
    RLock lock = redissonClient.getLock("lock:order");
    lock.lock();
    try {
        inner();   // 内部再次获取同一把锁
    } finally {
        lock.unlock();
    }
}

public void inner() {
    RLock lock = redissonClient.getLock("lock:order");
    lock.lock();   // 可重入，不会死锁
    try {
        // 业务
    } finally {
        lock.unlock();
    }
}
```

> 可重入的意义：如果方法 A 调用了方法 B，而 A、B 都加了同一把锁，不可重入的锁会直接死锁。Redisson 的可重入避免了这种悲剧。

---

## 1.6 公平锁与非公平锁

默认的 `getLock()` 是非公平锁（谁抢到算谁的）。Redisson 还提供公平锁，按请求顺序排队获取：

```java
RLock fairLock = redissonClient.getFairLock("lock:fair");
fairLock.lock();
try {
    // 业务
} finally {
    fairLock.unlock();
}
```

| 锁类型 | 获取方式 | 特点 |
| :-- | :-- | :-- |
| 非公平锁 | `getLock()` | 吞吐高，可能饿死 |
| 公平锁 | `getFairLock()` | 按顺序，公平但吞吐略低 |

> 大多数业务用默认的非公平锁即可，只有「严格按请求顺序执行」的场景才需要公平锁。

---

## 1.7 本章小结

| 要点 | 说明 |
| :-- | :-- |
| 为什么用 Redisson | 封装了续期、可重入、误删防护 |
| 基本用法 | `getLock()` + `tryLock(waitTime, leaseTime, unit)` |
| 看门狗 | 不指定 leaseTime 时自动续期，业务耗时不确定首选 |
| 可重入 | 同线程可多次获取，内部计数 |
| 公平锁 | `getFairLock()` 按顺序，默认非公平锁即可 |

> 记住核心原则：**业务耗时不确定就用 `lock()`（靠看门狗续期），明确短任务才用 `tryLock(..., leaseTime, ...)`**。这是用好 Redisson 分布式锁的第一课。
