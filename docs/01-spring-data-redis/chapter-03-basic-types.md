# 第3章 五种数据结构操作

> 主站第一卷第 2 章讲了 String / Hash / List / Set / ZSet 五种类型的语义与命令，本章对应讲解它们在 Spring Data Redis 里怎么用 `opsForXxx` 系列接口操作。只要记住「类型 → 操作接口」的映射，就能顺畅调用。

---

## 3.1 操作接口总览

Spring Data Redis 通过 `RedisTemplate` 暴露了按类型划分的操作接口，对应关系如下：

| Redis 类型 | 操作接口 | 获取方式 |
| :-- | :-- | :-- |
| String | `ValueOperations` | `opsForValue()` |
| Hash | `HashOperations` | `opsForHash()` |
| List | `ListOperations` | `opsForList()` |
| Set | `SetOperations` | `opsForSet()` |
| ZSet | `ZSetOperations` | `opsForZSet()` |

本章示例统一使用 `StringRedisTemplate`（value 为字符串），符合第 2 章推荐的最佳实践。

---

## 3.2 String：`opsForValue()`

对应 `SET / GET / INCR / SETNX` 等命令，是最常用的操作。

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class StringOpsDemo {

    private final StringRedisTemplate redis;

    public StringOpsDemo(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void demo() {
        ValueOperations<String, String> ops = redis.opsForValue();

        // SET / GET
        ops.set("user:1:name", "张三");
        String name = ops.get("user:1:name");           // 张三

        // SET EX（带过期时间）
        ops.set("session:abc", "token", Duration.ofMinutes(30));

        // SETNX（不存在才设置）
        Boolean ok = ops.setIfAbsent("lock:order", "uuid", Duration.ofSeconds(10));

        // INCR 原子自增（计数器）
        Long views = ops.increment("article:1:views");   // 1
        Long views2 = ops.increment("article:1:views");  // 2

        // 批量操作
        Map<String, String> map = Map.of("k1", "v1", "k2", "v2");
        ops.multiSet(map);
        List<String> values = ops.multiGet(List.of("k1", "k2"));
    }
}
```

> 注意 `setIfAbsent` 就是 `SETNX`，配合过期时间可实现分布式锁（详见第四卷）。

---

## 3.3 Hash：`opsForHash()`

对应 `HSET / HGET / HINCRBY` 等命令，适合存对象的多个字段。

```java
import org.springframework.data.redis.core.HashOperations;

@Component
public class HashOpsDemo {

    private final StringRedisTemplate redis;

    public HashOpsDemo(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void demo() {
        HashOperations<String, Object, Object> ops = redis.opsForHash();

        String key = "user:1";

        // HSET 设置字段
        ops.put(key, "name", "张三");
        ops.put(key, "age", "25");
        ops.put(key, "email", "zhangsan@qq.com");

        // HGET 获取单个字段
        Object name = ops.get(key, "name");              // 张三

        // HMGET 批量获取
        List<Object> fields = ops.multiGet(key, List.of("name", "age"));

        // HGETALL 获取全部
        Map<Object, Object> all = ops.entries(key);

        // HINCRBY 字段自增
        ops.increment(key, "age", 1);                    // age 变 26

        // HDEL 删除字段
        ops.delete(key, "email");
    }
}
```

---

## 3.4 List：`opsForList()`

对应 `LPUSH / RPUSH / LRANGE / BLPOP` 等命令，适合队列和最新列表。

```java
import org.springframework.data.redis.core.ListOperations;

@Component
public class ListOpsDemo {

    private final StringRedisTemplate redis;

    public ListOpsDemo(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void demo() {
        ListOperations<String, String> ops = redis.opsForList();

        // RPUSH 从右侧入队（队列）
        ops.rightPush("task:queue", "任务A");
        ops.rightPush("task:queue", "任务B");

        // LPUSH 从左侧插入（最新列表）
        ops.leftPush("news:list", "文章3");
        ops.leftPush("news:list", "文章2");
        ops.leftPush("news:list", "文章1");

        // LRANGE 获取所有
        List<String> news = ops.range("news:list", 0, -1);
        // [文章1, 文章2, 文章3]

        // LPOP / RPOP 弹出
        String task = ops.leftPop("task:queue");          // 任务A

        // LLEN 长度
        Long size = ops.size("news:list");                // 3
    }
}
```

> 阻塞弹出 `BLPOP` 在 Spring 里用 `ops.leftPop(key, timeout)`，适合做消息队列（对比 Stream 见第 4 章）。

---

## 3.5 Set：`opsForSet()`

对应 `SADD / SMEMBERS / SINTER` 等命令，适合去重和集合运算。

```java
import org.springframework.data.redis.core.SetOperations;

@Component
public class SetOpsDemo {

    private final StringRedisTemplate redis;

    public SetOpsDemo(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void demo() {
        SetOperations<String, String> ops = redis.opsForSet();

        // SADD 添加
        ops.add("user:1:friends", "uid:456", "uid:789", "uid:101");
        ops.add("user:2:friends", "uid:456", "uid:999");

        // SMEMBERS 获取全部
        Set<String> members = ops.members("user:1:friends");

        // SISMEMBER 判断存在
        Boolean isFriend = ops.isMember("user:1:friends", "uid:456");

        // SINTER 交集（共同好友）
        Set<String> common = ops.intersect("user:1:friends", "user:2:friends");
        // [uid:456]

        // SUNION / SDIFF
        Set<String> union = ops.union("user:1:friends", "user:2:friends");
        Set<String> diff = ops.difference("user:1:friends", "user:2:friends");

        // SRANDMEMBER 随机取（抽奖）
        List<String> lucky = ops.randomMembers("user:1:friends", 2);

        // SCARD 数量
        Long count = ops.size("user:1:friends");
    }
}
```

---

## 3.6 ZSet：`opsForZSet()`

对应 `ZADD / ZRANGE / ZINCRBY` 等命令，适合排行榜、延迟队列。

```java
import org.springframework.data.redis.core.ZSetOperations;

import java.util.Set;

@Component
public class ZSetOpsDemo {

    private final StringRedisTemplate redis;

    public ZSetOpsDemo(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void demo() {
        ZSetOperations<String, String> ops = redis.opsForZSet();

        // ZADD 添加（成员 + 分值）
        ops.add("leaderboard", "张三", 100);
        ops.add("leaderboard", "李四", 200);
        ops.add("leaderboard", "王五", 150);

        // ZREVRANGE 降序取 Top（排行榜）
        Set<String> top = ops.reverseRange("leaderboard", 0, 2);
        // [李四, 王五, 张三]

        // 带分值
        Set<ZSetOperations.TypedTuple<String>> topWithScore =
                ops.reverseRangeWithScores("leaderboard", 0, 2);

        // ZSCORE 获取分值
        Double score = ops.score("leaderboard", "张三");   // 100.0

        // ZINCRBY 增加分值（热搜词计数）
        ops.incrementScore("leaderboard", "张三", 50);

        // ZRANK 获取排名（从 0 开始，升序）
        Long rank = ops.rank("leaderboard", "张三");
    }
}
```

---

## 3.7 本章小结

| 类型 | 接口 | 典型方法 |
| :-- | :-- | :-- |
| String | `opsForValue()` | `set` / `get` / `increment` / `setIfAbsent` |
| Hash | `opsForHash()` | `put` / `get` / `entries` / `increment` |
| List | `opsForList()` | `rightPush` / `leftPop` / `range` |
| Set | `opsForSet()` | `add` / `members` / `intersect` |
| ZSet | `opsForZSet()` | `add` / `reverseRange` / `incrementScore` |

> 规律：方法名基本与 Redis 原生命令一一对应（`SET` → `set`、`INCR` → `increment`、`ZREVRANGE` → `reverseRange`），记不住时查命令名即可反推。
