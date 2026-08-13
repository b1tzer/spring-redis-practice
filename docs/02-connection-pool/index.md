# 第二卷 客户端与连接池

> 对应主站《Redis World》第二卷「单机内核」。主站讲线程模型、RESP、持久化，本卷讲 Spring 下 Lettuce / Jedis 的选择、连接池配置与线程模型的落地。

## 章节规划

- 第1章 Lettuce vs Jedis — 客户端对比与选型
- 第2章 连接池配置 — Lettuce 共享连接、Jedis 池化参数
- 第3章 线程模型落地 — 同步 / 异步 / 响应式 API
- 第4章 超时与重试 — 连接超时、命令超时、故障重试
- 第5章 持久化与配置 — RDB/AOF 配置在 Spring 环境下的建议
