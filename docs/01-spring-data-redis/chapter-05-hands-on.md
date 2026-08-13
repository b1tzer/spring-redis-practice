# 第5章 实战演练

> 主站第一卷第 2 章末尾的实操演示用 `redis-cli` 展示了五种类型的真实场景，本章用 Spring Boot 复刻同样的场景：计数器、购物车、最新列表、共同好友、排行榜。学完这一章，你应该能独立把一个业务场景映射成 Redis 数据模型 + Spring 代码。

---

## 5.1 项目准备

沿用第 1 章的接入配置，注入 `StringRedisTemplate`。为保持代码整洁，把五个场景各封装成一个 `@Service`。

```text
com.example.demo
├── service
│   ├── CounterService.java      # 计数器（String）
│   ├── CartService.java         # 购物车（Hash）
│   ├── NewsService.java         # 最新列表（List）
│   ├── FriendService.java       # 共同好友（Set）
│   └── LeaderboardService.java  # 排行榜（ZSet）
```

---

## 5.2 场景一：计数器（String）

点赞数、阅读量、库存这类「原子增减」用 `INCR`，天然无并发问题。

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class CounterService {

    private final StringRedisTemplate redis;

    public CounterService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** 阅读量 +1 */
    public Long incrementViews(Long articleId) {
        return redis.opsForValue().increment("article:" + articleId + ":views");
    }

    /** 获取当前阅读量 */
    public Long getViews(Long articleId) {
        String v = redis.opsForValue().get("article:" + articleId + ":views");
        return v == null ? 0L : Long.parseLong(v);
    }
}
```

> 为什么不用「读出来 +1 再写回」？因为那不是原子操作，并发下会丢失更新。`INCR` 单命令原子，是计数器的唯一正确姿势。

---

## 5.3 场景二：购物车（Hash）

购物车是典型的「key = 用户，field = 商品，value = 数量」，每个商品独立更新。

```java
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class CartService {

    private final StringRedisTemplate redis;

    public CartService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    private String key(Long userId) {
        return "cart:" + userId;
    }

    /** 添加商品（数量 +n） */
    public void addItem(Long userId, Long productId, int count) {
        redis.opsForHash().increment(key(userId), String.valueOf(productId), count);
    }

    /** 获取购物车全部内容 */
    public Map<Object, Object> getCart(Long userId) {
        return redis.opsForHash().entries(key(userId));
    }

    /** 删除商品 */
    public void removeItem(Long userId, Long productId) {
        redis.opsForHash().delete(key(userId), String.valueOf(productId));
    }
}
```

> 对比「String 存整个 JSON 购物车」：Hash 能独立更新单个商品数量，不需要全量覆盖，并发更安全。

---

## 5.4 场景三：最新列表（List）

「最新 10 条动态」用 `LPUSH` 头部插入 + `LRANGE` 取前 N 条。

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NewsService {

    private final StringRedisTemplate redis;

    public NewsService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    private static final int MAX_SIZE = 100; // 最多保留 100 条

    /** 发布新动态（头部插入） */
    public void publish(String news) {
        redis.opsForList().leftPush("news:list", news);
        redis.opsForList().trim("news:list", 0, MAX_SIZE - 1); // 裁剪，防止无限增长
    }

    /** 获取最新 N 条 */
    public List<String> latest(int n) {
        return redis.opsForList().range("news:list", 0, n - 1);
    }
}
```

> `trim` 很重要：List 不设上限会无限增长，用 `LTRIM` 裁剪只保留最新 N 条，避免内存被历史数据撑爆。

---

## 5.5 场景四：共同好友（Set）

用 `SINTER` 求两个用户好友集合的交集。

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class FriendService {

    private final StringRedisTemplate redis;

    public FriendService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    private String key(Long userId) {
        return "user:" + userId + ":friends";
    }

    /** 添加好友 */
    public void addFriend(Long userId, Long friendId) {
        redis.opsForSet().add(key(userId), String.valueOf(friendId));
    }

    /** 共同好友 */
    public Set<String> commonFriends(Long userId1, Long userId2) {
        return redis.opsForSet().intersect(key(userId1), key(userId2));
    }

    /** 判断是否为好友 */
    public boolean isFriend(Long userId, Long friendId) {
        return Boolean.TRUE.equals(
                redis.opsForSet().isMember(key(userId), String.valueOf(friendId)));
    }
}
```

---

## 5.6 场景五：排行榜（ZSet）

`ZADD` 存分值，`ZREVRANGE` 取 Top，`ZINCRBY` 动态加分。

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class LeaderboardService {

    private final StringRedisTemplate redis;

    public LeaderboardService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    private static final String KEY = "leaderboard";

    /** 加分（如打榜） */
    public void addScore(String player, double score) {
        redis.opsForZSet().incrementScore(KEY, player, score);
    }

    /** Top N 玩家 */
    public Set<String> top(int n) {
        return redis.opsForZSet().reverseRange(KEY, 0, n - 1);
    }

    /** 玩家当前排名（从 1 开始） */
    public long rank(String player) {
        Long rank = redis.opsForZSet().reverseRank(KEY, player);
        return rank == null ? -1 : rank + 1;
    }
}
```

> 注意 `reverseRank` 返回的是从 0 开始的下标，业务上「第 1 名」要 +1。

---

## 5.7 五个场景小结

| 场景 | 类型 | 核心方法 | 关键点 |
| :-- | :-- | :-- | :-- |
| 计数器 | String | `increment` | 原子性，避免丢失更新 |
| 购物车 | Hash | `increment` / `entries` | 字段独立更新 |
| 最新列表 | List | `leftPush` + `trim` | 裁剪防无限增长 |
| 共同好友 | Set | `intersect` | 集合运算天然去重 |
| 排行榜 | ZSet | `incrementScore` / `reverseRange` | 自动排序 |

> 建模心法：**先问「这个数据有什么特征」再选类型**——要原子计数选 String，要字段独立更新选 Hash，要队列选 List，要去重选 Set，要排序选 ZSet。类型选对了，代码往往水到渠成。

---

## 5.8 卷末回顾

第一卷完成了从「接入 → 序列化 → 五种类型 → 高级类型 → 实战」的闭环。到这里你已经能用 Spring Data Redis 完成绝大多数日常 CRUD 与常见业务建模。

下一卷将进入「客户端与连接池」，回答 Lettuce 和 Jedis 怎么选、连接池怎么配、线程模型如何落地——这是从「能用」走向「用好」的关键一步。
