# 第一卷 Spring Data Redis 基础

> 对应主站《Redis World》第一卷「数据模型与命令」。主站讲五种数据结构的语义与命令，本卷讲这些结构在 Spring Data Redis 下怎么操作、序列化怎么选。

## 章节规划

- 第1章 快速接入 — 依赖引入、`RedisTemplate` / `StringRedisTemplate` 配置
- 第2章 序列化选型 — JDK 序列化 vs JSON vs String，序列化器的坑
- 第3章 五种数据结构操作 — String / Hash / List / Set / ZSet 的 `opsForXxx` 用法
- 第4章 高级类型操作 — BitMap / HyperLogLog / Geo / Stream
- 第5章 实战演练 — 用 Spring 复刻主站第一卷的实操场景
