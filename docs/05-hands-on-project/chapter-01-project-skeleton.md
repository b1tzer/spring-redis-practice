# 第1章 项目骨架

> 最后一卷，我们用 Spring Boot 从零搭建一个可运行的项目，实现「缓存接口 + 分布式锁 + 限流器」三个场景。本章先搭骨架：依赖、配置、目录结构。这一步做扎实，后面四章才能专注写业务。

---

## 1.1 项目目标

复刻主站第五卷的 Python 实战项目，但用 Spring Boot 实现。三个场景对应全书三大主题：

| 场景 | 解决的问题 | 用到的知识 |
| :-- | :-- | :-- |
| 缓存接口 | 高频读用户信息，缓解数据库压力 | 第一卷 String、第三卷 Cache-Aside |
| 分布式锁 | 并发下重复扣减库存 | 第四卷 Redisson |
| 限流器 | 保护接口不被刷爆 | 第一卷 ZSet、第四卷 RRateLimiter |

---

## 1.2 依赖清单

`pom.xml` 核心依赖：

```xml
<dependencies>
    <!-- Web 层 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- Redis（默认 Lettuce） -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>

    <!-- Redisson（分布式锁、限流器） -->
    <dependency>
        <groupId>org.redisson</groupId>
        <artifactId>redisson-spring-boot-starter</artifactId>
        <version>3.27.0</version>
    </dependency>

    <!-- 测试 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

> 依赖说明：`spring-boot-starter-data-redis` 提供 `StringRedisTemplate`（做缓存），`redisson-spring-boot-starter` 提供 `RedissonClient`（做锁和限流），两者互补。

---

## 1.3 配置文件

`application.yml`：

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      timeout: 3s
      lettuce:
        pool:
          max-active: 16
          max-idle: 8

server:
  port: 8080
```

> 本地先用单机 Redis，生产环境按第四卷第 3、4 章切换为哨兵或集群配置即可。

---

## 1.4 目录结构

```text
src/main/java/com/example/redispractice/
├── RedisPracticeApplication.java   # 启动类
├── config/
│   └── RedisConfig.java            # StringRedisTemplate（可选，默认已够用）
├── controller/
│   ├── UserController.java         # 场景一：缓存接口
│   ├── StockController.java        # 场景二：分布式锁扣库存
│   └── RateLimitController.java    # 场景三：限流接口
├── service/
│   ├── UserService.java            # 缓存接口逻辑
│   ├── StockService.java           # 扣库存（分布式锁）
│   └── RateLimitService.java       # 限流逻辑
└── model/
    └── User.java                   # 用户实体
```

---

## 1.5 启动类

```java
package com.example.redispractice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class RedisPracticeApplication {
    public static void main(String[] args) {
        SpringApplication.run(RedisPracticeApplication.class, args);
    }
}
```

> 本项目不使用 `@EnableCaching`（那是 Spring Cache 抽象，第三卷已讲）。本卷为了演示原理，缓存接口用 `StringRedisTemplate` 手动实现 Cache-Aside，更直观地展示「先查缓存 → 未命中查库 → 回填缓存」的完整链路。

---

## 1.6 准备 Redis 环境

本地用 Docker 起一个 Redis：

```bash
docker run -d --name redis-practice -p 6379:6379 redis:7.2
```

验证：

```bash
redis-cli ping   # 返回 PONG
```

---

## 1.7 本章小结

| 要点 | 说明 |
| :-- | :-- |
| 依赖 | data-redis（缓存）+ redisson（锁/限流） |
| 配置 | 本地单机 Redis，生产换哨兵/集群 |
| 结构 | controller / service / model / config 分层 |
| 设计 | 用 StringRedisTemplate 手动实现，展示原理 |

> 骨架搭好后，从下一章开始逐个实现三个场景。每一章都遵循「业务背景 → 代码实现 → 关键点」的结构，方便你直接复制到自己的项目里。
