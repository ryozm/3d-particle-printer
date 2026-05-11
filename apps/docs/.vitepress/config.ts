import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '3D Particle Printer',
  description: '明日方舟：终末地 官网 3D 模型打印/加载动效开源复刻',
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: '演示', link: '/demo' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '简介', link: '/guide/' },
            { text: '快速开始', link: '/guide/getting-started' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ryozm/3d-particle-printer' },
    ],
  },
})
