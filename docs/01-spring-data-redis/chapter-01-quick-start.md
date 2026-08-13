# 第1章 快速接入

> 主站第一卷讲「Redis 是什么、五种类型怎么用」，本章回答：在 Spring Boot 项目里，如何用最小成本把 Redis 接进来，并理解 `RedisTemplate` 与 `StringRedisTemplate` 这两个核心入口的区别。

---

## 1.1 引入依赖

Spring Data Redis 是 Spring 生态操作 Redis 的官方抽象，底层默认使用 Lettuce 作为客户端。Spring Boot 通过 `spring-boot-starter-data-redis` 一站式引入。

Maven（`pom.xml`）：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

Gradle（`build.gradle`）：

```groovy
implementation 'org.springframework.boot:spring-boot-starter-data-redis'
```

> 这个 starter 会自动引入 Lettuce 客户端、连接池（commons-pool2）以及 Spring Data Redis 核心。Spring Boot 2.x 之后默认客户端是 **Lettuce**，不再默认使用 Jedis（详见第二卷）。

---

## 1.2 基础配置

在 `application.yml` 中配置连接信息：

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password:          # 无密码可留空
      database: 0        # 使用第 0 个数据库
      timeout: 3s        # 命令超时时间
      lettuce:
        pool:
          max-active: 8    # 连接池最大连接数
          max-idle: 8      # 最大空闲连接
          min-idle: 0      # 最小空闲连接
          max-wait: -1ms   # 获取连接最大等待时间（-1 表示无限）
```

最简配置只需 `host` 和 `port`，其余都有默认值。本地 Docker 起的 Redis 用默认配置即可连上。

---

## 1.3 RedisTemplate 与 StringRedisTemplate

Spring Data Redis 提供了两个开箱即用的模板类：

| 类 | 泛型 | 默认序列化 | 适用场景 |
| :-- | :-- | :-- | :-- |
| `RedisTemplate<K, V>` | 任意对象 | JDK 序列化 | 存 Java 对象 |
| `StringRedisTemplate` | String → String | String 序列化 | 存字符串（最常用） |

`StringRedisTemplate` 继承自 `RedisTemplate<String, String>`，key 和 value 都用 `StringRedisSerializer`，**可读性最好、最直观**，日常缓存、计数器、分布式锁等场景首选它。

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class HelloRedis {

    private final StringRedisTemplate redis;

    public HelloRedis(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void demo() {
        redis.opsForValue().set("greeting", "hello redis");
        String value = redis.opsForValue().get("greeting");
        System.out.println(value); // hello redis
    }
}
```

> 注入方式：直接构造器注入 `StringRedisTemplate`，Spring Boot 已自动配置好实例，无需手动 new。

---

## 1.4 自定义 RedisTemplate（存对象时）

当需要存 Java 对象（而非纯字符串）时，默认的 JDK 序列化会有两个问题：① key 在 Redis 里是不可读的二进制；② 对象必须实现 `Serializable`。更推荐自定义一个用 JSON 序列化的 `RedisTemplate`：

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // key 用字符串，可读
        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);

        // value 用 JSON
        GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer();
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }
}
```

序列化的深入讲解与各种序列化器的「坑」见第 2 章。

---

## 1.5 最小可运行验证

接好后写一个最简单的验证入口：

```java
import org.springframework.boot.CommandLineRunner;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class QuickStartRunner implements CommandLineRunner {

    private final StringRedisTemplate redis;

    public QuickStartRunner(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public void run(String... args) {
        redis.opsForValue().set("ping", "pong");
        System.out.println("Redis 连接成功: " + redis.opsForValue().get("ping"));
    }
}
```

启动应用，控制台输出 `Redis 连接成功: pong`，即代表接入完成。

> 也可以直接用 `redis-cli` 验证：`redis-cli GET ping` 应返回 `pong`。

---

## 1.6 本章小结

| 要点 | 说明 |
| :-- | :-- |
| 依赖 | `spring-boot-starter-data-redis`，默认 Lettuce |
| 配置 | `spring.data.redis.*`，最简只需 host/port |
| 模板 | 字符串场景用 `StringRedisTemplate`，对象场景自定义 `RedisTemplate` + JSON |
| 序列化 | 默认 JDK 序列化有可读性与 Serializable 限制，推荐 JSON（详见第 2 章） |

> 先记住一条选择原则：**能用字符串就用 `StringRedisTemplate`，需要存对象再上自定义 JSON 模板**。这一条能帮你避开新手期 80% 的序列化坑。
