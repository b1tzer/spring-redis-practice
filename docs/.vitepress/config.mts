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
          ]
        },
        {
          text: '第二卷 客户端与连接池',
          collapsed: false,
          items: [
            { text: '概览', link: '/02-connection-pool/' },
          ]
        },
        {
          text: '第三卷 Spring Cache',
          collapsed: false,
          items: [
            { text: '概览', link: '/03-spring-cache/' },
          ]
        },
        {
          text: '第四卷 分布式与高可用',
          collapsed: false,
          items: [
            { text: '概览', link: '/04-distributed-ha/' },
          ]
        },
        {
          text: '第五卷 实战项目',
          collapsed: false,
          items: [
            { text: '概览', link: '/05-hands-on-project/' },
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
