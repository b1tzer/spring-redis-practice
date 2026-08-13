# 第三卷 Spring Cache

> 对应主站《Redis World》第三卷「缓存工程」。主站讲穿透、击穿、雪崩、一致性，本卷讲 Spring Cache 抽象（`@Cacheable` 系列）如何落到 Redis，以及三兄弟的 Java 解法。

## 章节

- [第1章 Spring Cache 抽象](/03-spring-cache/chapter-01-cache-annotation) — `@Cacheable` / `@CachePut` / `@CacheEvict` / `@Caching`
- [第2章 集成 Redis](/03-spring-cache/chapter-02-redis-integration) — `RedisCacheManager` 配置、TTL、Key 生成策略
- [第3章 缓存穿透](/03-spring-cache/chapter-03-penetration) — 空值缓存、布隆过滤器（Redisson）
- [第4章 缓存击穿](/03-spring-cache/chapter-04-breakdown) — 互斥锁、逻辑过期
- [第5章 缓存雪崩与一致性](/03-spring-cache/chapter-05-avalanche-consistency) — TTL 随机、双删策略、延迟双删
