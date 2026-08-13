import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

const SITE_BASE = '/spring-redis-practice/'

export default withMermaid(
  defineConfig({
    title: 'Spring Redis Practice',
    description: 'Spring 框架下的 Redis 实战专题 —— 《Redis World》的 Spring 落地篇',
    lang: 'zh-CN',
    base: SITE_BASE,
    lastUpdated: true,
    sitemap: {
      hostname: 'https://thestack.xpro.wang/spring-redis-practice/',
    },

    head: [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: '/spring-redis-practice/favicon.svg' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:title', content: 'Spring Redis Practice' }],
      ['meta', { property: 'og:description', content: 'Spring 框架下的 Redis 实战专题 —— 《Redis World》的 Spring 落地篇' }],
      ['meta', { property: 'og:url', content: 'https://thestack.xpro.wang/spring-redis-practice/' }],
      ['meta', { name: 'twitter:card', content: 'summary' }],
      ['meta', { name: 'theme-color', content: '#6DB33F' }],
      ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1' }],
    ],

    themeConfig: {
      siteTitle: 'Spring Redis Practice',
      logo: '/spring-redis-practice/logo.svg',

      nav: [
        { text: '首页', link: '/' },
        {
          text: '目录',
          items: [
            { text: '第一卷 Spring Data Redis 基础', link: '/01-spring-data-redis/' },
            { text: '第二卷 客户端与连接池', link: '/02-connection-pool/' },
            { text: '第三卷 Spring Cache', link: '/03-spring-cache/' },
            { text: '第四卷 分布式与高可用', link: '/04-distributed-ha/' },
            { text: '第五卷 实战项目', link: '/05-hands-on-project/' },
          ]
        },
        { text: '主站《Redis World》', link: 'https://github.com/b1tzer/redis-world' },
        { text: 'GitHub', link: 'https://github.com/b1tzer/spring-redis-practice' },
      ],

      sidebar: [
        {
          text: '第一卷 Spring Data Redis 基础',
          collapsed: false,
          items: [
            { text: '概览', link: '/01-spring-data-redis/' },
            { text: '第1章 快速接入', link: '/01-spring-data-redis/chapter-01-quick-start' },
            { text: '第2章 序列化选型', link: '/01-spring-data-redis/chapter-02-serialization' },
            { text: '第3章 五种数据结构操作', link: '/01-spring-data-redis/chapter-03-basic-types' },
            { text: '第4章 高级类型操作', link: '/01-spring-data-redis/chapter-04-advanced-types' },
            { text: '第5章 实战演练', link: '/01-spring-data-redis/chapter-05-hands-on' },
          ]
        },
        {
          text: '第二卷 客户端与连接池',
          collapsed: false,
          items: [
            { text: '概览', link: '/02-connection-pool/' },
            { text: '第1章 Lettuce vs Jedis', link: '/02-connection-pool/chapter-01-lettuce-vs-jedis' },
            { text: '第2章 连接池配置', link: '/02-connection-pool/chapter-02-pool-config' },
            { text: '第3章 线程模型落地', link: '/02-connection-pool/chapter-03-thread-model' },
            { text: '第4章 超时与重试', link: '/02-connection-pool/chapter-04-timeout-retry' },
            { text: '第5章 持久化与配置', link: '/02-connection-pool/chapter-05-persistence-config' },
          ]
        },
        {
          text: '第三卷 Spring Cache',
          collapsed: false,
          items: [
            { text: '概览', link: '/03-spring-cache/' },
            { text: '第1章 Spring Cache 抽象', link: '/03-spring-cache/chapter-01-cache-annotation' },
            { text: '第2章 集成 Redis', link: '/03-spring-cache/chapter-02-redis-integration' },
            { text: '第3章 缓存穿透', link: '/03-spring-cache/chapter-03-penetration' },
            { text: '第4章 缓存击穿', link: '/03-spring-cache/chapter-04-breakdown' },
            { text: '第5章 缓存雪崩与一致性', link: '/03-spring-cache/chapter-05-avalanche-consistency' },
          ]
        },
        {
          text: '第四卷 分布式与高可用',
          collapsed: false,
          items: [
            { text: '概览', link: '/04-distributed-ha/' },
            { text: '第1章 Redisson 分布式锁', link: '/04-distributed-ha/chapter-01-redisson-lock' },
            { text: '第2章 分布式锁的坑', link: '/04-distributed-ha/chapter-02-lock-pitfalls' },
            { text: '第3章 主从 / 哨兵接入', link: '/04-distributed-ha/chapter-03-sentinel' },
            { text: '第4章 集群接入', link: '/04-distributed-ha/chapter-04-cluster' },
            { text: '第5章 其他分布式组件', link: '/04-distributed-ha/chapter-05-other-components' },
          ]
        },
        {
          text: '第五卷 实战项目',
          collapsed: false,
          items: [
            { text: '概览', link: '/05-hands-on-project/' },
            { text: '第1章 项目骨架', link: '/05-hands-on-project/chapter-01-project-skeleton' },
            { text: '第2章 缓存接口', link: '/05-hands-on-project/chapter-02-cache-service' },
            { text: '第3章 分布式锁', link: '/05-hands-on-project/chapter-03-distributed-lock' },
            { text: '第4章 限流器', link: '/05-hands-on-project/chapter-04-rate-limiter' },
            { text: '第5章 串联验证与压测', link: '/05-hands-on-project/chapter-05-verify-benchmark' },
          ]
        },
      ],

      search: {
        provider: 'local',
        options: {
          translations: {
            button: { buttonText: '搜索文档', buttonAriaLabel: '搜索' },
            modal: {
              noResultsText: '没有找到结果',
              resetButtonTitle: '清除查询',
              footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
            }
          }
        }
      },

      footer: {
        message: '基于 MIT 发布',
        copyright: '© 2026 Spring Redis Practice'
      },

      outline: { level: [2, 3], label: '本章目录' },
      docFooter: { prev: '上一章', next: '下一章' },
      returnToTopLabel: '回到顶部',
      sidebarMenuLabel: '菜单',
      darkModeSwitchLabel: '主题',

      socialLinks: [
        { icon: 'github', link: 'https://github.com/b1tzer/spring-redis-practice' }
      ],
    },

    markdown: {
      lineNumbers: true,
    },

    mermaid: {
      flowchart: {
        padding: 24,
      },
    },
  })
)
