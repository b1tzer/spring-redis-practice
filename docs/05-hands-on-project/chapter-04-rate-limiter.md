# 第4章 限流器

> 场景三：接口限流，防止被恶意刷爆。本章用两种方式实现：先用 ZSet 手写滑动窗口限流（讲透原理），再对比 Redisson 的 `RRateLimiter`（省事）。串起第一卷 ZSet、第四卷第 5 章的知识。

---

## 4.1 业务背景

一个接口被高频调用，需要在单位时间内限制请求次数。例如：**每个用户每分钟最多 10 次请求**。

限流算法有固定窗口、滑动窗口、令牌桶、漏桶等。本章重点讲**滑动窗口**——它比固定窗口更平滑，能避免「窗口交界瞬间双倍放行」的突发问题。

---

## 4.2 方案一：ZSet 手写滑动窗口

核心思路：用 ZSet 记录每次请求的时间戳（score），每次请求先删除窗口外的旧记录，再统计窗口内请求数。

```java
package com.example.redispractice.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collections;

@Service
public class RateLimitService {

    private final StringRedisTemplate redis;

    // Lua 脚本：删旧 + 计数 + 加新，三步原子执行
    private static final String LUA_SCRIPT = """
            redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
            local count = redis.call('ZCARD', KEYS[1])
            if count < tonumber(ARGV[2]) then
                redis.call('ZADD', KEYS[1], ARGV[3], ARGV[3])
                redis.call('EXPIRE', KEYS[1], ARGV[4])
                return 1
            else
                return 0
            end
            """;

    private final DefaultRedisScript<Long> script;

    public RateLimitService(StringRedisTemplate redis) {
        this.redis = redis;
        this.script = new DefaultRedisScript<>(LUA_SCRIPT, Long.class);
    }

    /**
     * 滑动窗口限流
     * @param userId    用户标识
     * @param limit     窗口内最大请求数
     * @param windowSec 窗口大小（秒）
     * @return true=放行，false=限流
     */
    public boolean isAllowed(String userId, int limit, long windowSec) {
        String key = "rate:" + userId;
        long now = Instant.now().getEpochSecond();
        long windowStart = now - windowSec;

        // KEYS[1]=key, ARGV[1]=窗口起点, ARGV[2]=limit, ARGV[3]=now, ARGV[4]=windowSec
        Long result = redis.execute(
                script,
                Collections.singletonList(key),
                String.valueOf(windowStart),
                String.valueOf(limit),
                String.valueOf(now),
                String.valueOf(windowSec)
        );
        return result != null && result == 1L;
    }
}
```

---

## 4.3 为什么必须用 Lua

限流的三步操作「删旧记录 → 统计数量 → 加新记录」如果不原子，会有并发问题：

```text
线程A 删旧 → 统计=9 → 准备加新
线程B 删旧 → 统计=9 → 准备加新
线程A 加新 → 10
线程B 加新 → 11（超限了）
```

Lua 脚本在 Redis 服务端**单线程原子执行**，保证三步不会被打断。这正是主站第二卷「命令单线程执行」特性的实际运用。

---

## 4.4 方案二：Redisson RRateLimiter（省事）

手写滑动窗口能讲透原理，但生产更常用 Redisson 的现成组件（第四卷第 5 章已介绍）：

```java
import org.redisson.api.RRateLimiter;
import org.redisson.api.RateIntervalUnit;
import org.redisson.api.RateType;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;

@Service
public class RedissonRateLimitService {

    private final RedissonClient redissonClient;

    public RedissonRateLimitService(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }

    public boolean isAllowed(String userId, int limit) {
        RRateLimiter limiter = redissonClient.getRateLimiter("rate:" + userId);
        // 初始化：每分钟 limit 个请求
        limiter.trySetRate(RateType.OVERALL, limit, 1, RateIntervalUnit.MINUTES);
        return limiter.tryAcquire();
    }
}
```

---

## 4.5 两种方案对比

| 维度 | ZSet 手写滑动窗口 | Redisson RRateLimiter |
| :-- | :-- | :-- |
| 算法 | 滑动窗口 | 令牌桶（可配） |
| 实现复杂度 | 中（需 Lua） | 低 |
| 精度 | 高（精确到秒） | 高 |
| 可控性 | 完全可控 | 依赖 Redisson 封装 |
| 学习价值 | 理解原理 | 快速落地 |

> 建议：**学习用 ZSet 手写理解原理，生产用 Redisson 组件快速落地**。两者不是二选一，而是「懂原理 + 用工具」的结合。

---

## 4.6 Controller 层

```java
package com.example.redispractice.controller;

import com.example.redispractice.service.RateLimitService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class RateLimitController {

    private final RateLimitService rateLimitService;

    public RateLimitController(RateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
    }

    @GetMapping("/test")
    public String test(@RequestParam String userId) {
        boolean allowed = rateLimitService.isAllowed(userId, 10, 60);
        return allowed ? "请求放行" : "请求被限流";
    }
}
```

---

## 4.7 验证

```bash
# 连续请求 11 次（限流阈值 10/分钟），第 11 次应被限流
for i in {1..11}; do
  curl "http://localhost:8080/api/test?userId=user1"
  echo
done
```

---

## 4.8 本章小结

| 要点 | 说明 |
| :-- | :-- |
| 滑动窗口 | ZSet 记录时间戳，删旧 + 计数 + 加新 |
| 原子性 | 三步操作用 Lua 保证原子 |
| 现成方案 | Redisson `RRateLimiter` 更省事 |
| 取舍 | 手写学原理，生产用组件 |

> 限流器的灵魂是「原子性」。无论手写还是用组件，都必须保证「判断 + 放行」不可分割，否则高并发下限流失效。
