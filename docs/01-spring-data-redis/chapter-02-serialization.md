# 第2章 序列化选型

> 序列化是 Spring Data Redis 最容易踩坑的地方。默认的 JDK 序列化会让 key 变成一坨二进制，排查问题时要靠猜。本章讲清 JDK / JSON / String 三种序列化器的差异，以及各自隐藏的坑，给出可复用的最佳实践。

---

## 2.1 为什么序列化这么重要

Redis 存储的是字节流，而 Java 操作的是对象。序列化就是「对象 → 字节」和「字节 → 对象」的桥梁。序列化选错，带来的问题包括：

| 问题 | 表现 |
| :-- | :-- |
| key 不可读 | `redis-cli` 里看到的是 `\xac\xed\x00\x05...` |
| 强耦合 | 对象必须实现 `Serializable`，加字段后反序列化报错 |
| 跨语言不友好 | 别的服务（Go/Python）读不了 Java 序列化的数据 |
| 存储膨胀 | 序列化字节可能比原数据大很多 |

> 核心原则：**key 一定要可读（用字符串），value 按数据类型选择合适的序列化器**。

---

## 2.2 三种常用序列化器

Spring Data Redis 内置的序列化器：

| 序列化器 | 输出 | key 可读性 | 适用场景 |
| :-- | :-- | :-- | :-- |
| `JdkSerializationRedisSerializer` | 二进制 | ❌ 差 | 默认值，一般不推荐 |
| `StringRedisSerializer` | UTF-8 字符串 | ✅ 好 | 字符串、数字、JSON 文本 |
| `GenericJackson2JsonRedisSerializer` | JSON 文本 | ✅ 好 | 存 Java 对象 |

### 2.2.1 JDK 序列化（默认，慎用）

`RedisTemplate` 默认使用 JDK 序列化。写一个 key 试试：

```java
redisTemplate.opsForValue().set("user:1", user);
```

在 `redis-cli` 里看：

```text
127.0.0.1:6379> keys *
1) "\xac\xed\x00\x05t\x00\x06user:1"
```

key 前面多了一串 `\xac\xed\x00\x05t\x00` 前缀——这是 JDK 序列化的类型描述符，导致 key 完全不可读。

**三个坑**：

1. **可读性差**：排查问题必须借助工具解码，效率低。
2. **必须实现 `Serializable`**：否则抛 `NotSerializableException`。
3. **版本兼容差**：类加字段后，旧数据反序列化可能抛 `InvalidClassException`（`serialVersionUID` 不一致）。

### 2.2.2 String 序列化（最常用）

`StringRedisTemplate` 默认用 `StringRedisSerializer`，写入的是 UTF-8 字符串，可读性好：

```java
stringRedisTemplate.opsForValue().set("greeting", "hello");
```

```text
127.0.0.1:6379> get greeting
"hello"
```

缺点：**只能存字符串**。存对象时需要手动转成 JSON 字符串，读回来再反序列化：

```java
String json = objectMapper.writeValueAsString(user);  // 对象 → JSON 字符串
stringRedisTemplate.opsForValue().set("user:1", json);

String cached = stringRedisTemplate.opsForValue().get("user:1");
User user = objectMapper.readValue(cached, User.class); // JSON 字符串 → 对象
```

### 2.2.3 GenericJackson2JsonRedisSerializer（存对象）

直接存对象，自动序列化为 JSON，读取时自动反序列化。它会在 JSON 里额外存一个 `@class` 字段记录类型信息，保证反序列化时能找到正确的类：

```java
// 自定义 RedisTemplate（见第 1 章 1.4 节）
redisTemplate.opsForValue().set("user:1", user);
User u = (User) redisTemplate.opsForValue().get("user:1");
```

Redis 中实际存储（简化示意）：

```json
{"@class":"com.example.User","id":1,"name":"张三","age":25}
```

---

## 2.3 JSON 序列化器的坑

`GenericJackson2JsonRedisSerializer` 虽好用，但有两个必须知道的坑：

### 坑一：`@class` 类型信息带来的耦合

JSON 里存的 `@class` 是完整类路径。如果类**改名或移动包**，旧数据反序列化时会抛 `ClassNotFoundException`。解决办法：为字段类型固定不变的场景才用 JSON 对象序列化，否则用 String 序列化 + 手动转换。

### 坑二：LocalDateTime 等特殊类型

`GenericJackson2JsonRedisSerializer` 默认的 `ObjectMapper` 不支持 Java 8 时间类型，直接存 `LocalDateTime` 会报错或序列化成非预期格式。需要自定义：

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

ObjectMapper mapper = new ObjectMapper();
mapper.registerModule(new JavaTimeModule());
mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

GenericJackson2JsonRedisSerializer serializer =
        new GenericJackson2JsonRedisSerializer(mapper);
```

---

## 2.4 序列化器选型决策表

| 需求 | 推荐方案 |
| :-- | :-- |
| 存字符串 / 数字 / 计数器 | `StringRedisTemplate`（String 序列化） |
| 存 JSON 文本（自己控制格式） | `StringRedisTemplate` + Jackson 手动转换 |
| 存 Java 对象（图省事） | 自定义 `RedisTemplate` + `GenericJackson2JsonRedisSerializer` |
| 存二进制（文件、图片） | 直接存 `byte[]`，不经过字符串序列化 |
| 跨语言共享数据 | 必须用 JSON / 字符串，**绝不用 JDK 序列化** |

---

## 2.5 推荐的最佳实践

生产环境最常见的组合是：**key 用 String，value 用 JSON，且尽量用 `StringRedisTemplate` 手动控制序列化**。这样带来的好处：

1. key 永远可读，排查方便；
2. value 是标准 JSON，跨语言、跨服务都能读；
3. 序列化行为完全可控，不依赖框架「魔法」。

```java
@Component
public class UserCacheService {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public UserCacheService(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    public void save(User user) throws JsonProcessingException {
        String json = objectMapper.writeValueAsString(user);
        redis.opsForValue().set("user:" + user.getId(), json, Duration.ofMinutes(30));
    }

    public User get(Long id) throws JsonProcessingException {
        String json = redis.opsForValue().get("user:" + id);
        return json == null ? null : objectMapper.readValue(json, User.class);
    }
}
```

> 这个「String 序列化 + 手动 JSON」的模式贯穿本专题后续所有章节，是规避序列化坑的最稳妥做法。

---

## 2.6 本章小结

| 序列化器 | 结论 |
| :-- | :-- |
| JDK 序列化 | 默认但别用，可读性差、需 Serializable、版本兼容差 |
| String 序列化 | 最常用，key/value 可读，配合 Jackson 手动转换对象 |
| GenericJackson2JsonRedisSerializer | 存对象方便，但注意 `@class` 耦合与时间类型坑 |

> 记住一句：**key 用 String 序列化，value 尽量用 JSON，对象转换自己做主**。
