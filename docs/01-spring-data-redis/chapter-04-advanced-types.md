# 第4章 高级类型操作

> 主站第一卷第 3 章讲了 BitMap / HyperLogLog / Geo / Stream 四类高级类型，本章对应讲解它们在 Spring Data Redis 里的操作接口。这四类不是独立类型，而是对 String / ZSet 的封装，操作接口也相应「寄生」在 `opsForValue` 或独立接口上。

---

## 4.1 BitMap：位操作

BitMap 基于 String，通过 `opsForValue().setBit() / getBit()` 操作。适合签到、在线状态这类「是/否」标记。

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class BitMapDemo {

    private final StringRedisTemplate redis;

    public BitMapDemo(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void demo() {
        // SETBIT：将第 100 位设为 1（用户 100 已签到）
        redis.opsForValue().setBit("sign:20240101", 100, true);
        redis.opsForValue().setBit("sign:20240101", 101, true);

        // GETBIT：读取第 100 位
        Boolean signed = redis.opsForValue().getBit("sign:20240101", 100); // true

        // BITCOUNT：统计为 1 的位数（签到人数）
        // 注意：RedisTemplate 不直接暴露 bitCount，需用 execute 回调原生连接
        Long count = redis.execute((org.springframework.data.redis.connection.RedisConnection conn) ->
                conn.bitCount("sign:20240101".getBytes()));
    }
}
```

> `bitCount` 这类命令 `opsForValue()` 没有直接封装，需要用 `execute` 拿到底层连接调用。这提醒我们：**Spring Data Redis 封装了常用命令，但并非全部，遇到没封装的用 `execute` 兜底**。

---

## 4.2 HyperLogLog：基数统计

HyperLogLog 有独立的操作接口 `opsForHyperLogLog()`，对应 `PFADD / PFCOUNT / PFMERGE`。适合 UV（独立访客）统计。

```java
import org.springframework.data.redis.core.HyperLogLogOperations;
import org.springframework.stereotype.Component;

@Component
public class HyperLogLogDemo {

    private final StringRedisTemplate redis;

    public HyperLogLogDemo(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void demo() {
        HyperLogLogOperations<String, String> ops = redis.opsForHyperLogLog();

        // PFADD：添加元素
        ops.add("uv:20240101", "user1", "user2", "user3");
        ops.add("uv:20240101", "user3");              // 重复，不计数

        // PFCOUNT：估算不重复元素数量
        Long uv = ops.size("uv:20240101");            // 约 3

        // PFMERGE：合并多个 HLL
        Long merged = ops.union("uv:total", "uv:20240101", "uv:20240102");
    }
}
```

> 记忆点：HyperLogLog 固定 12KB 内存，误差约 0.81%，只能统计数量、**不能取出具体元素**。要「去重且能取出」请用 Set。

---

## 4.3 Geo：地理位置

Geo 有独立的操作接口 `opsForGeo()`，对应 `GEOADD / GEODIST / GEOSEARCH`。适合「附近的人」「配送范围」。

```java
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.connection.RedisGeoCommands.GeoLocation;
import org.springframework.data.redis.core.GeoOperations;
import org.springframework.stereotype.Component;

@Component
public class GeoDemo {

    private final StringRedisTemplate redis;

    public GeoDemo(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void demo() {
        GeoOperations<String, String> ops = redis.opsForGeo();

        // GEOADD：添加经纬度
        ops.add("cities", new Point(116.40, 39.90), "北京");
        ops.add("cities", new Point(121.47, 31.23), "上海");

        // GEODIST：两点距离（公里）
        Distance dist = ops.distance("cities", "北京", "上海", Metrics.KILOMETERS);
        System.out.println(dist.getValue());          // 约 1068 km

        // GEOPOS：获取坐标
        Point beijing = ops.position("cities", "北京");

        // GEOSEARCH：半径内查询
        var result = ops.radius("cities", "北京", new Distance(1000, Metrics.KILOMETERS));
    }
}
```

> 注意坐标顺序：Redis Geo 用的是「经度 longitude, 纬度 latitude」，即 `Point(经度, 纬度)`，很多新手会把经纬度写反，导致位置查询结果离谱。

---

## 4.4 Stream：消息流

Stream 有独立的操作接口 `opsForStream()`，对应 `XADD / XREAD / XREADGROUP`，用于实现带消费者组的消息队列。

```java
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StreamOperations;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class StreamDemo {

    private final StringRedisTemplate redis;

    public StreamDemo(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void demo() {
        StreamOperations<String, Object, Object> ops = redis.opsForStream();

        // XADD：追加消息（* 表示自动生成 ID）
        MapRecord<String, Object, Object> record =
                StreamRecords.newRecord()
                        .ofMap(Map.of("field1", "value1", "field2", "value2"))
                        .withStreamKey("mystream");
        var messageId = ops.add(record);

        // XRANGE：读取消息
        var messages = ops.range("mystream",
                org.springframework.data.domain.Range.unbounded());

        // 消费者组读取（XREADGROUP）
        // 详见主站第一卷第 3 章 Stream 部分，Spring 下通过 StreamMessageListenerContainer 消费
    }
}
```

> Stream 的消息读取后仍保留，配合消费者组支持 ACK 与重试，语义接近 Kafka。Spring 生态下完整消费通常用 `StreamMessageListenerContainer` 监听，属于较进阶用法，此处点到为止。

---

## 4.5 高级类型速查

| 类型 | 操作接口 | 关键方法 | 典型场景 |
| :-- | :-- | :-- | :-- |
| BitMap | `opsForValue()` | `setBit` / `getBit` | 签到、在线状态 |
| HyperLogLog | `opsForHyperLogLog()` | `add` / `size` / `union` | UV 统计 |
| Geo | `opsForGeo()` | `add` / `distance` / `radius` | 附近的人、配送 |
| Stream | `opsForStream()` | `add` / `range` | 消息队列 |

---

## 4.6 本章小结

| 要点 | 说明 |
| :-- | :-- |
| 接口归属 | BitMap 寄生在 `opsForValue`，HLL/Geo/Stream 有独立接口 |
| 未封装命令 | `bitCount` 等需用 `execute` 拿底层连接兜底 |
| Geo 坐标 | 顺序是「经度, 纬度」，别写反 |
| Stream | 消息保留 + 消费者组，语义比 List 队列更完整 |

> 这四类高级类型都建立在对基础类型的封装之上，理解它们「寄生」于哪个类型，能帮你更快定位接口归属。
