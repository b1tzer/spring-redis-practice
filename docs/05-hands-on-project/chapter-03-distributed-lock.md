# 第3章 分布式锁

> 场景二：并发下扣减库存。如果不用锁，两个请求同时「读库存 → 判断 → 扣减」，会超卖。本章用 Redisson 分布式锁保证扣减的原子性，串起第四卷第 1、2 章的知识。

---

## 3.1 业务背景

扣减库存是典型的「读-改-写」操作，并发下会超卖：

```text
线程A 读到库存 5 → 判断够 → 准备扣减
线程B 读到库存 5 → 判断够 → 准备扣减
线程A 扣减 → 库存 4
线程B 扣减 → 库存 4（本应是 3，超卖了）
```

用分布式锁，让「读-改-写」变成临界区，同一时刻只有一个线程执行。

---

## 3.2 库存服务

```java
package com.example.redispractice.service;

import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class StockService {

    private static final String STOCK_KEY = "stock:item:100";

    private final StringRedisTemplate redis;
    private final RedissonClient redissonClient;

    public StockService(StringRedisTemplate redis, RedissonClient redissonClient) {
        this.redis = redis;
        this.redissonClient = redissonClient;
    }

    /** 扣减库存（分布式锁保证原子） */
    public boolean deduct(int count) {
        RLock lock = redissonClient.getLock("lock:" + STOCK_KEY);

        try {
            // 尝试加锁，最多等 3 秒；不指定 leaseTime，靠看门狗续期
            boolean locked = lock.tryLock(3, TimeUnit.SECONDS);
            if (!locked) {
                throw new RuntimeException("获取锁失败，请重试");
            }

            // 临界区：读-判断-扣减
            String stockStr = redis.opsForValue().get(STOCK_KEY);
            int stock = stockStr == null ? 0 : Integer.parseInt(stockStr);
            if (stock < count) {
                return false;   // 库存不足
            }
            redis.opsForValue().decrement(STOCK_KEY, count);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("加锁被中断", e);
        } finally {
            // 释放锁（校验归属，防止误删）
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    /** 初始化库存（演示用） */
    public void initStock(int count) {
        redis.opsForValue().set(STOCK_KEY, String.valueOf(count));
    }

    /** 查询剩余库存 */
    public int getStock() {
        String s = redis.opsForValue().get(STOCK_KEY);
        return s == null ? 0 : Integer.parseInt(s);
    }
}
```

---

## 3.3 Controller 层

```java
package com.example.redispractice.controller;

import com.example.redispractice.service.StockService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/stock")
public class StockController {

    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    @PostMapping("/init")
    public String init(@RequestParam(defaultValue = "100") int count) {
        stockService.initStock(count);
        return "ok";
    }

    @PostMapping("/deduct")
    public String deduct(@RequestParam(defaultValue = "1") int count) {
        boolean success = stockService.deduct(count);
        return success ? "扣减成功，剩余 " + stockService.getStock()
                       : "库存不足";
    }

    @GetMapping
    public int getStock() {
        return stockService.getStock();
    }
}
```

---

## 3.4 关键点：为什么用 `tryLock(3, SECONDS)` 不指定 leaseTime

回顾第四卷第 1 章的内容：

| 用法 | leaseTime | 看门狗 | 适用 |
| :-- | :-- | :-- | :-- |
| `tryLock(3, SECONDS)` | 未指定 | ✅ 自动续期 | 业务耗时不确定 |
| `tryLock(3, 10, SECONDS)` | 指定 10s | ❌ 不续期 | 明确短任务 |

扣库存的业务耗时包含「读 Redis + 判断 + 扣减」，通常很快，但极端情况（网络抖动、GC 停顿）可能超预期。**不指定 leaseTime，让看门狗自动续期**，避免锁提前释放导致超卖。

> 释放锁时 `isHeldByCurrentThread()` 校验归属，防止「业务执行完时锁已过期被别人拿到，结果误删别人的锁」（第四卷第 2 章坑二）。

---

## 3.5 验证

```bash
# 初始化库存 100
curl -X POST "http://localhost:8080/stock/init?count=100"

# 扣减 1 个
curl -X POST "http://localhost:8080/stock/deduct?count=1"

# 查看剩余
curl http://localhost:8080/stock
```

高并发验证（模拟 100 个并发扣减）：

```bash
# 用 ab 或 jmeter 并发压测，观察库存是否精确扣到 0，无超卖
```

---

## 3.6 本章小结

| 要点 | 说明 |
| :-- | :-- |
| 问题 | 「读-改-写」并发下超卖 |
| 解法 | Redisson 分布式锁，临界区串行 |
| 加锁 | `tryLock(3, SECONDS)` 不指定 leaseTime，看门狗续期 |
| 释放 | `isHeldByCurrentThread()` 校验归属，防误删 |

> 分布式锁的核心价值：把「非原子的多步操作」变成「原子的临界区」。理解这一点，就知道锁该加在哪、什么时候该释放。
