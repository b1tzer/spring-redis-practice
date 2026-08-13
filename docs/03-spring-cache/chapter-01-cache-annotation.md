# 第1章 Spring Cache 抽象

> 主站第三卷讲缓存穿透、击穿、雪崩，但在此之前，要先掌握 Spring 官方提供的缓存抽象——一套 `@Cacheable` 系列注解。它让你不写一行缓存代码，就能给方法加缓存。本章讲清这五个注解的语义、区别与组合用法。

---

## 1.1 什么是 Spring Cache 抽象

Spring Cache 是 Spring 提供的一套**声明式缓存抽象**，核心思想是：**用注解声明「这个方法的结果要缓存」**，具体存到哪里（Redis / 本地 Caffeine / 内存 Map）由底层的 `CacheManager` 决定。

```text
业务代码（加注解）  →  Cache 抽象（统一 API）  →  CacheManager（Redis/Caffeine/...）
```

好处：业务代码和缓存实现解耦。今天用本地缓存，明天换 Redis，业务代码一行不用改，只换配置。

---

## 1.2 开启缓存注解

在启动类或配置类上加 `@EnableCaching`：

```java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching   // 开启 Spring Cache 注解支持
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

> 不加 `@EnableCaching`，所有缓存注解都不会生效，这是新手最容易漏的一步。

---

## 1.3 五个核心注解

| 注解 | 作用 | 触发时机 |
| :-- | :-- | :-- |
| `@Cacheable` | 有缓存则返回缓存，没有则执行方法并缓存 | 方法执行**前**查缓存 |
| `@CachePut` | 无论有无缓存都执行方法，并**更新**缓存 | 方法执行**后**写缓存 |
| `@CacheEvict` | 删除缓存 | 方法执行后（或前）删缓存 |
| `@Caching` | 组合多个缓存注解 | — |
| `@CacheConfig` | 类级别的公共缓存配置 | — |

---

## 1.4 @Cacheable：查缓存

`@Cacheable` 是最常用的注解。执行方法前先查缓存，命中则直接返回，不执行方法体；未命中才执行方法，并把结果写入缓存。

```java
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    @Cacheable(value = "user", key = "#id")
    public User getUserById(Long id) {
        // 第一次调用：查数据库；后续调用：直接走缓存，不执行这里
        System.out.println("查数据库: " + id);
        return queryFromDb(id);
    }

    private User queryFromDb(Long id) {
        // 模拟数据库查询
        return new User(id, "张三");
    }
}
```

关键属性：

| 属性 | 说明 |
| :-- | :-- |
| `value` / `cacheNames` | 缓存名（对应 Redis 的 key 前缀） |
| `key` | 缓存 key 的 SpEL 表达式，`#id` 表示用参数 id |
| `condition` | 满足条件才缓存（如 `#id > 0`） |
| `unless` | 满足条件就**不**缓存（如 `#result == null`） |

> `key` 的 SpEL 写法是核心：`#参数名` 引用参数，`#result` 引用返回值，`#p0`/`#a0` 引用第一个参数。

---

## 1.5 @CachePut：更新缓存

`@CachePut` 和 `@Cacheable` 相反：**总是执行方法，并把结果写入缓存**。适合「既要更新数据库、又要同步更新缓存」的场景。

```java
@CachePut(value = "user", key = "#user.id")
public User updateUser(User user) {
    // 总是执行，更新数据库
    updateDb(user);
    return user;   // 返回值会被写入缓存
}
```

> `@CachePut` 和 `@Cacheable` 的区别是考试/面试高频点：前者**始终执行方法体**，后者**命中缓存时跳过方法体**。

---

## 1.6 @CacheEvict：删除缓存

`@CacheEvict` 用于删除缓存，常在「删除数据」「更新数据」时配合使用。

```java
@CacheEvict(value = "user", key = "#id")
public void deleteUser(Long id) {
    deleteFromDb(id);
}
```

`allEntries` 属性：删除缓存名下所有 key（慎用，会清空整个缓存空间）：

```java
@CacheEvict(value = "user", allEntries = true)
public void clearAllUserCache() {
    // 清空 user 缓存空间
}
```

`beforeInvocation` 属性：`true` 表示方法执行**前**先删缓存，`false`（默认）表示执行后再删。

---

## 1.7 @Caching 与 @CacheConfig

### @Caching：组合多个操作

一个方法可能需要同时做「查缓存 + 删缓存」等多件事，用 `@Caching` 组合：

```java
@Caching(
    evict = {
        @CacheEvict(value = "user", key = "#user.id"),
        @CacheEvict(value = "userList", allEntries = true)
    },
    put = {
        @CachePut(value = "user", key = "#user.id")
    }
)
public User save(User user) {
    // 先删旧缓存，再写新缓存
    return saveToDb(user);
}
```

### @CacheConfig：类级公共配置

当类里所有方法的缓存名都一样，用 `@CacheConfig` 提取公共配置，避免重复写 `value`：

```java
@Service
@CacheConfig(cacheNames = "user")   // 类级别统一缓存名
public class UserService {

    @Cacheable(key = "#id")
    public User getById(Long id) { ... }   // 不用再写 value

    @CacheEvict(key = "#id")
    public void delete(Long id) { ... }
}
```

---

## 1.8 注解组合实战：一次完整缓存读写

```java
@Service
@CacheConfig(cacheNames = "user")
public class UserService {

    // 读：有缓存走缓存
    @Cacheable(key = "#id", unless = "#result == null")
    public User getById(Long id) {
        return queryFromDb(id);
    }

    // 更新：更新数据库 + 更新缓存
    @CachePut(key = "#user.id")
    public User update(User user) {
        updateDb(user);
        return user;
    }

    // 删除：删除数据库 + 删除缓存
    @CacheEvict(key = "#id")
    public void delete(Long id) {
        deleteFromDb(id);
    }
}
```

> 标准套路：**读用 `@Cacheable`，改用 `@CachePut`，删用 `@CacheEvict`**。三个注解对应缓存的三类操作，缺一不可。

---

## 1.9 本章小结

| 注解 | 核心语义 | 一句话记忆 |
| :-- | :-- | :-- |
| `@Cacheable` | 先查缓存，命中跳过方法 | 读缓存 |
| `@CachePut` | 总是执行方法并更新缓存 | 写缓存 |
| `@CacheEvict` | 删除缓存 | 删缓存 |
| `@Caching` | 组合多个操作 | 组合拳 |
| `@CacheConfig` | 类级公共配置 | 省重复 |

> 注意：本章只讲了注解语义，**还没接入 Redis**。默认情况下 Spring Cache 用内存 Map 做缓存，重启即失效。下一章讲如何换成 Redis，并配置 TTL 与 Key 生成策略。
