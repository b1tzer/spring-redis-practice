# 第四卷 分布式与高可用

> 对应主站《Redis World》第四卷「高可用与分布式」。主站讲主从、哨兵、集群、分布式锁，本卷讲 Redisson 分布式锁、主从/哨兵/集群在 Spring 下的接入。

## 章节

- [第1章 Redisson 分布式锁](/04-distributed-ha/chapter-01-redisson-lock) — `RLock`、看门狗、可重入、公平锁
- [第2章 分布式锁的坑](/04-distributed-ha/chapter-02-lock-pitfalls) — 超时、误删、主从切换丢锁（红锁）
- [第3章 主从 / 哨兵接入](/04-distributed-ha/chapter-03-sentinel) — `LettuceConnectionFactory` 的哨兵配置
- [第4章 集群接入](/04-distributed-ha/chapter-04-cluster) — Redis Cluster 的 Spring 配置与跨槽限制
- [第5章 其他分布式组件](/04-distributed-ha/chapter-05-other-components) — 布隆过滤器、限流器、延迟队列
