# 第5章 串联验证与压测

> 前四章完成了三个场景的代码实现。本章把它们串起来验证：写单元测试覆盖核心逻辑，再做一次简单的压测，用数据对比「有缓存 vs 无缓存」「有锁 vs 无锁」的效果。这也是主站第五卷「先测量、后优化」思想的应用。

---

## 5.1 单元测试：缓存接口

用 Spring Boot Test 验证缓存命中逻辑：

```java
package com.example.redispractice;

import com.example.redispractice.model.User;
import com.example.redispractice.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class UserServiceTest {

    @Autowired
    private UserService userService;

    @Autowired
    private StringRedisTemplate redis;

    @Test
    void testCacheAside() {
        // 第一次：回源数据库
        User u1 = userService.getById(1L);
        assertNotNull(u1);
        assertEquals("张三", u1.getName());

        // 缓存已存在
        assertNotNull(redis.opsForValue().get("user:1"));

        // 第二次：应命中缓存（UserDao 的 50ms 延迟会被跳过）
        long start = System.currentTimeMillis();
        User u2 = userService.getById(1L);
        long cost = System.currentTimeMillis() - start;

        assertEquals(u1.getName(), u2.getName());
        assertTrue(cost < 10, "命中缓存应远快于 50ms 回源，实际耗时 " + cost + "ms");
    }

    @Test
    void testUpdateInvalidateCache() {
        // 更新用户，缓存应被删除
        userService.update(new User(2L, "李四改", 31, "lisi2@qq.com"));
        assertNull(redis.opsForValue().get("user:2"));
    }
}
```

---

## 5.2 单元测试：分布式锁扣库存

并发扣减库存，验证不超卖：

```java
package com.example.redispractice;

import com.example.redispractice.service.StockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class StockServiceTest {

    @Autowired
    private StockService stockService;

    @BeforeEach
    void setUp() {
        stockService.initStock(100);
    }

    @Test
    void testConcurrentDeductNoOversell() throws InterruptedException {
        int threads = 100;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger success = new AtomicInteger(0);

        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                try {
                    if (stockService.deduct(1)) {
                        success.incrementAndGet();
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await();
        pool.shutdown();

        // 100 个并发各扣 1，应恰好成功 100 次，剩余 0，不超卖
        assertEquals(100, success.get(), "应恰好扣减成功 100 次");
        assertEquals(0, stockService.getStock(), "库存应精确扣到 0");
    }
}
```

> 这个测试是分布式锁价值的直接证明：如果去掉锁，100 个并发扣减会出现「剩余库存 > 0 但部分请求失败」或「超卖」的错乱现象。

---

## 5.3 简单压测对比

用 `ab`（Apache Bench）做简单压测，对比缓存命中率：

```bash
# 压测缓存接口（先预热一次，让缓存命中）
ab -n 10000 -c 100 http://localhost:8080/user/1
```

预期结果对比：

| 指标 | 无缓存（每次回源 50ms） | 有缓存（命中 Redis） |
| :-- | :-- | :-- |
| 平均响应时间 | ~50ms+ | ~1ms 以内 |
| QPS | ~200（受 DB 延迟限制） | 数千以上 |
| 数据库压力 | 10000 次查询 | 1 次查询 |

> 这正是 Redis 作为缓存的根本价值：**把数据库从「每次请求都查」中解放出来**。压测数据会直观展示「有缓存」带来的数量级提升。

---

## 5.4 三个场景回顾

| 场景 | 核心实现 | 关键点 | 对应章节 |
| :-- | :-- | :-- | :-- |
| 缓存接口 | StringRedisTemplate + Cache-Aside | 读写顺序、TTL | 第一卷 + 第三卷 |
| 分布式锁 | Redisson RLock | 看门狗、防误删 | 第四卷第 1、2 章 |
| 限流器 | ZSet 滑动窗口 + Lua | 原子性 | 第一卷 + 第四卷第 5 章 |

---

## 5.5 完整项目运行清单

```bash
# 1. 起 Redis
docker run -d --name redis-practice -p 6379:6379 redis:7.2

# 2. 启动项目
mvn spring-boot:run

# 3. 验证缓存接口
curl http://localhost:8080/user/1

# 4. 验证分布式锁（初始化 + 扣减）
curl -X POST "http://localhost:8080/stock/init?count=100"
curl -X POST "http://localhost:8080/stock/deduct?count=1"

# 5. 验证限流
curl "http://localhost:8080/api/test?userId=user1"

# 6. 跑测试
mvn test
```

---

## 5.6 卷末总结：全专题收官

到这里，`spring-redis-practice` 五卷全部完成：

| 卷 | 主题 | 核心收获 |
| :-- | :-- | :-- |
| 第一卷 | Spring Data Redis 基础 | 会用五种数据结构、序列化选型 |
| 第二卷 | 客户端与连接池 | 会选客户端、配连接池、调超时重试 |
| 第三卷 | Spring Cache | 会用注解缓存、解决穿透/击穿/雪崩 |
| 第四卷 | 分布式与高可用 | 会用 Redisson 锁、接入哨兵/集群 |
| 第五卷 | 实战项目 | 把前四卷串成可运行项目 |

> 与主站《Redis World》的关系：主站回答「Redis 是什么、为什么」，本专题回答「在 Spring 里怎么写」。两站对照阅读，原理与落地互为印证。

---

## 5.7 本章小结

| 要点 | 说明 |
| :-- | :-- |
| 单元测试 | 验证缓存命中、锁不超卖 |
| 压测对比 | 有缓存 vs 无缓存的量级差异 |
| 运行清单 | 一键复现三个场景 |
| 全专题收官 | 五卷知识闭环 |

> 实战项目不是终点，而是起点。建议你把这个项目跑通后，回看对应章节，体会「原理如何落到代码」。掌握这套方法，你就能独立设计任何 Redis 业务场景了。
