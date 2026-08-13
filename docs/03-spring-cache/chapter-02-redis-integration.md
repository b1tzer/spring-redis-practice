# 第2章 集成 Redis

> 上一章讲的 `@Cacheable` 默认用内存 Map，重启即失效，生产环境不可用。本章把 Spring Cache 的底层换成 Redis，并配置 TTL、Key 生成策略、序列化。这一步做对了，注解缓存才真正能用。

---

## 2.1 引入依赖

Spring Cache 接入 Redis 需要两个依赖：`spring-boot-starter-data-redis`（提供 Redis 连接）和 `spring-boot-starter-cache`（提供缓存注解支持）。

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-cache</artifactId>
</dependency>
```

> 实际上 `spring-boot-starter-data-redis` 已传递引入 cache 相关能力，但显式加 `spring-boot-starter-cache` 更清晰、不依赖隐式传递。

---

## 2.2 配置 RedisCacheManager

Spring Boot 检测到 Redis 依赖后，会自动创建 `RedisCacheManager`。但默认配置很简陋：**没有 TTL、key 序列化用 JDK**。生产必须自定义：

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

@Configuration
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        // 默认缓存配置：TTL 30 分钟，JSON 序列化
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(30))                      // TTL 30 分钟
                .disableCachingNullValues()                            // 不缓存 null（防穿透需另配，见第3章）
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair
                                .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair
                                .fromSerializer(new GenericJackson2JsonRedisSerializer()));

        return RedisCacheManager.builder(factory)
                .cacheDefaults(config)
                .build();
    }
}
```

---

## 2.3 关键配置项

| 配置 | 说明 | 建议 |
| :-- | :-- | :-- |
| `entryTtl` | 缓存过期时间 | 按业务定，一般 5~30 分钟 |
| `disableCachingNullValues` | 是否缓存 null | 默认 false（会缓存 null）；防穿透时反而要**缓存空值** |
| `serializeKeysWith` | key 序列化 | 用 `StringRedisSerializer`，保证可读 |
| `serializeValuesWith` | value 序列化 | 用 JSON，避免 JDK 二进制 |

> 注意 `disableCachingNullValues` 的语义：`@Cacheable` 方法返回 null 时，默认会把这个 null 也缓存起来（不执行方法）。这在「防穿透」里有用（见第 3 章），但也可能带来「缓存 null」的误解，需按场景决定。

---

## 2.4 多个缓存空间不同 TTL

不同业务的缓存过期时间往往不同（如用户信息 30 分钟、字典表 2 小时）。可以用 `withCacheConfiguration` 为每个缓存名单独配置：

```java
return RedisCacheManager.builder(factory)
        .cacheDefaults(defaultConfig)                       // 默认 30 分钟
        .withCacheConfiguration("user",
                defaultConfig.entryTtl(Duration.ofMinutes(30)))   // user 30 分钟
        .withCacheConfiguration("dict",
                defaultConfig.entryTtl(Duration.ofHours(2)))      // dict 2 小时
        .build();
```

> 缓存名（`value`）在这里就派上用场了：`@Cacheable(value = "user")` 会匹配到 `user` 的专属 TTL 配置。

---

## 2.5 Key 生成策略

`@Cacheable` 的 key 默认由 `SimpleKeyGenerator` 生成，规则是：

- 无参方法：key 为 `SimpleKey.EMPTY`
- 单参数：key 为该参数
- 多参数：key 为 `SimpleKey(参数1, 参数2, ...)`

默认生成的 key 可读性差，推荐**显式指定 key**：

```java
@Cacheable(value = "user", key = "#id")
public User getById(Long id) { ... }

@Cacheable(value = "user", key = "#userId + ':' + #type")
public User getByType(Long userId, String type) { ... }
```

最终在 Redis 里的 key 形式（简化）：`user::1` 或 `user::1:admin`（缓存名 + `::` + 你指定的 key）。

---

## 2.6 验证 Redis 缓存是否生效

配置完成后，运行一次 `@Cacheable` 方法，然后到 Redis 里看：

```bash
redis-cli keys "user*"       # 应能看到 user:: 开头的 key
redis-cli TTL "user::1"      # 应返回剩余过期时间（秒）
redis-cli GET "user::1"      # 应能看到 JSON 格式的 value
```

如果看到的是 `\xac\xed\x00\x05...` 开头，说明 key 序列化没配对，还在用 JDK 序列化，回去检查 `serializeKeysWith`。

---

## 2.7 本章小结

| 要点 | 说明 |
| :-- | :-- |
| 依赖 | `spring-boot-starter-data-redis` + `spring-boot-starter-cache` |
| 核心配置 | 自定义 `RedisCacheManager`，设 TTL + JSON 序列化 |
| 多 TTL | `withCacheConfiguration` 按缓存名单独配 |
| key 策略 | 显式指定 `key`，避免默认 `SimpleKey` 不可读 |
| 验证 | `redis-cli` 查 key 与 TTL，确认不是 JDK 二进制 |

> 这一章是把 Spring Cache 从「玩具」变成「可用」的关键一步。配好 `RedisCacheManager` 后，第 1 章的注解才真正落在 Redis 上。接下来的三章，聚焦缓存三大经典问题：穿透、击穿、雪崩。
