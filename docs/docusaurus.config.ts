import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
    title: 'Frappe JS Client',
    tagline: 'Fetch-native TypeScript client for Frappe REST (v14–v16)',

    future: {
        v4: true,
    },

    url: 'https://dhiashalabi.github.io',
    baseUrl: '/frappe-js-client/',
    trailingSlash: false,

    organizationName: 'dhiashalabi',
    projectName: 'frappe-js-client',

    onBrokenLinks: 'throw',

    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },

    plugins: [
        [
            'docusaurus-plugin-typedoc',
            {
                id: 'client-api',
                entryPoints: [
                    '../packages/client/src/index.ts',
                    '../packages/client/src/extended.ts',
                    '../packages/client/src/realtime.ts',
                    '../packages/client/src/testing.ts',
                    '../packages/client/src/errors.ts',
                    '../packages/client/src/middleware.ts',
                ],
                tsconfig: '../packages/client/tsconfig.json',
                out: './docs/api',
                readme: 'none',
                excludePrivate: true,
                excludeInternal: true,
                skipErrorChecking: true,
                sidebar: {
                    pretty: true,
                },
            },
        ],
        [
            'docusaurus-plugin-typedoc',
            {
                id: 'codegen-api',
                entryPoints: ['../packages/codegen/src/index.ts'],
                tsconfig: '../packages/codegen/tsconfig.docs.json',
                out: './docs/api-codegen',
                name: 'frappe-codegen',
                readme: 'none',
                excludePrivate: true,
                excludeInternal: true,
                skipErrorChecking: true,
                sidebar: {
                    pretty: true,
                },
            },
        ],
    ],

    themes: [
        [
            require.resolve('@easyops-cn/docusaurus-search-local'),
            {
                hashed: true,
                indexBlog: false,
                docsRouteBasePath: '/docs',
            },
        ],
    ],

    presets: [
        [
            'classic',
            {
                docs: {
                    sidebarPath: './sidebars.ts',
                    editUrl: 'https://github.com/dhiashalabi/frappe-js-client/tree/master/docs/',
                },
                blog: false,
                theme: {
                    customCss: './src/css/custom.css',
                },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        colorMode: {
            respectPrefersColorScheme: true,
        },
        navbar: {
            title: 'Frappe JS Client',
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'docsSidebar',
                    position: 'left',
                    label: 'Docs',
                },
                {
                    href: 'https://github.com/dhiashalabi/frappe-js-client',
                    label: 'GitHub',
                    position: 'right',
                },
                {
                    href: 'https://www.npmjs.com/package/frappe-js-client',
                    label: 'npm',
                    position: 'right',
                },
                {
                    href: 'https://www.npmjs.com/package/frappe-codegen',
                    label: 'codegen',
                    position: 'right',
                },
            ],
        },
        footer: {
            style: 'dark',
            links: [
                {
                    title: 'Docs',
                    items: [
                        {
                            label: 'Getting started',
                            to: '/docs/getting-started',
                        },
                        {
                            label: 'Client',
                            to: '/docs/client',
                        },
                        {
                            label: 'Codegen',
                            to: '/docs/codegen',
                        },
                        {
                            label: 'Client API',
                            to: '/docs/api',
                        },
                        {
                            label: 'Codegen API',
                            to: '/docs/api-codegen',
                        },
                    ],
                },
                {
                    title: 'Package',
                    items: [
                        {
                            label: 'GitHub',
                            href: 'https://github.com/dhiashalabi/frappe-js-client',
                        },
                        {
                            label: 'npm',
                            href: 'https://www.npmjs.com/package/frappe-js-client',
                        },
                        {
                            label: 'codegen',
                            href: 'https://www.npmjs.com/package/frappe-codegen',
                        },
                        {
                            label: 'Issues',
                            href: 'https://github.com/dhiashalabi/frappe-js-client/issues',
                        },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Dhia A. Shalabi. MIT License.`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: ['bash', 'json', 'typescript'],
        },
    } satisfies Preset.ThemeConfig,
}

export default config
