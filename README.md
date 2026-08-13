# Spring Redis Practice

《Redis World》的 Spring 落地篇 —— 系统讲解 **Spring 框架下如何使用 Redis**。

主站 [redis-world](https://github.com/b1tzer/redis-world) 讲「Redis 本身」（语言无关、原理优先），本专题回答「同样的知识，在 Spring 生态里代码怎么写」。两站镜像映射，互为补充。

**📖 在线阅读：[https://thestack.xpro.wang/spring-redis-practice/](https://thestack.xpro.wang/spring-redis-practice/)**

## 与主站的关系

| 主站《Redis World》（讲原理） | 本专题（讲 Spring 落地） |
| :-- | :-- |
| 第一卷 数据模型与命令 | Spring Data Redis 接入 + 五种数据结构操作 |
| 第二卷 单机内核 | Lettuce / Jedis 连接与线程模型落地 |
| 第三卷 缓存工程 | Spring Cache（`@Cacheable` 系列）+ 缓存三兄弟 |
| 第四卷 高可用与分布式 | Redisson 分布式锁 + 主从/哨兵/集群接入 |
| 第五卷 实战与运维 | 实战项目（缓存接口 + 分布式锁 + 限流器的 Java 版） |

## 内容结构

```
docs/
├── 01-spring-data-redis/    # 第一卷对应：接入、序列化、五种数据结构
├── 02-connection-pool/      # 第二卷对应：Lettuce/Jedis、连接池、线程模型
├── 03-spring-cache/         # 第三卷对应：Spring Cache、穿透/击穿/雪崩
├── 04-distributed-ha/       # 第四卷对应：Redisson 分布式锁、高可用接入
├── 05-hands-on-project/     # 第五卷对应：实战项目（Java 版）
└── index.md                 # 首页
```

## 技术栈

- [VitePress](https://vitepress.dev/) 1.6 — 静态站点生成器
- Spring Boot 3.x / Spring Data Redis / Redisson / Lettuce / Jedis — 讲解对象
- GitHub Actions + GitHub Pages — 自动部署

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建静态站点
npm run build

# 预览构建产物
npm run preview
```

## 部署

推送到 `main` 分支后，GitHub Actions 自动构建并部署到 GitHub Pages。

## License

MIT
