import Heading from '@theme/Heading'
import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './styles.module.css'

type FeatureItem = {
    title: string
    description: ReactNode
}

const FeatureList: FeatureItem[] = [
    {
        title: 'Frappe v14, v15, v16',
        description: (
            <>
                Default <code>{'{ apiVersion: 2 }'}</code> uses Frappe v15+ <code>/api/v2</code>. Pass{' '}
                <code>{'{ apiVersion: 1 }'}</code> for classic <code>/api/method</code> and <code>/api/resource</code>{' '}
                (v14-safe).
            </>
        ),
    },
    {
        title: 'Never /api/v1',
        description: (
            <>
                This client never calls <code>/api/v1/...</code>. That prefix 404s on v14. Classic unversioned paths
                still work on v15 and v16.
            </>
        ),
    },
    {
        title: 'TypeScript first',
        description: (
            <>
                Zero runtime dependencies. Transport is <code>fetch</code>. Use <code>FrappeDoc&lt;T&gt;</code> to type
                documents.
            </>
        ),
    },
    {
        title: 'Typed DocTypes',
        description: (
            <>
                <code>frappe-codegen</code> reads a live v15+ site and emits <code>GeneratedDocTypes</code> so{' '}
                <code>db.getDoc</code> infers the row.
            </>
        ),
    },
]

function Feature({ title, description }: FeatureItem) {
    return (
        <div className={clsx('col col--3')}>
            <div className="text--center padding-horiz--md">
                <Heading as="h3">{title}</Heading>
                <p>{description}</p>
            </div>
        </div>
    )
}

export default function HomepageFeatures(): ReactNode {
    return (
        <section className={styles.features}>
            <div className="container">
                <div className="row">
                    {FeatureList.map((props, idx) => (
                        <Feature
                            key={idx}
                            {...props}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}
