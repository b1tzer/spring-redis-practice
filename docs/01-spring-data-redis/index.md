# 第一卷 Spring Data Redis 基础

> 对应主站《Redis World》第一卷「数据模型与命令」。主站讲五种数据结构的语义与命令，本卷讲这些结构在 Spring Data Redis 下怎么操作、序列化怎么选。

## 章节

- [第1章 快速接入](/01-spring-data-redis/chapter-01-quick-start) — 依赖引入、`RedisTemplate` / `StringRedisTemplate` 配置
- [第2章 序列化选型](/01-spring-data-redis/chapter-02-serialization) — JDK vs JSON vs String，序列化器的坑
- [第3章 五种数据结构操作](/01-spring-data-redis/chapter-03-basic-types) — String / Hash / List / Set / ZSet 的 `opsForXxx` 用法
- [第4章 高级类型操作](/01-spring-data-redis/chapter-04-advanced-types) — BitMap / HyperLogLog / Geo / Stream
- [第5章 实战演练](/01-spring-data-redis/chapter-05-hands-on) — 计数器 / 购物车 / 最新列表 / 共同好友 / 排行榜
