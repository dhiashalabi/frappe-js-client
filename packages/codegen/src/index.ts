/**
 * frappe-codegen — programmatic API. Most users want the `frappe-codegen` CLI
 * (see README.md); this entry point is for build scripts that want to generate types as part of
 * their own pipeline instead of shelling out.
 *
 * @example
 * ```ts
 * import { createFrappeClient } from 'frappe-js-client'
 * import { fetchWithOptionalFollow, generateModule } from 'frappe-codegen'
 *
 * const client = createFrappeClient({ url, apiVersion: 2, auth })
 * const metas = await fetchWithOptionalFollow(client, ['ToDo'], true)
 * const source = generateModule(metas)
 * ```
 *
 * @packageDocumentation
 */

/** Overlay of CLI flags / script options merged over a config file. */
export type { CliOverlay, CodegenFileConfig, ResolvedCodegenConfig } from './config'
/** `frappe-codegen.config.json` filename, loader, and `mergeConfig` (file → env → overlay). */
export { DEFAULT_CONFIG_NAME, findDefaultConfigPath, loadConfigFile, mergeConfig } from './config'
/** Options for {@link generateInterface} / {@link generateModule}. */
export type { GenerateOptions } from './generate'
/** Turn DocType metadata into TypeScript source. */
export { assertUniqueInterfaceNames, generateInterface, generateModule, toInterfaceName } from './generate'
/** Normalized DocType metadata used by the generator. */
export type { DocField, DocTypeMeta } from './metadata'
/** Fetch DocType meta from a live v15+ site (`db.getMeta`, concurrency 4). */
export { fetchDocTypeMeta, fetchDocTypeMetas } from './metadata'
/** Collect DocType names from flags/modules and optionally follow Table children. */
export { fetchWithOptionalFollow, followChildTables, resolveDocTypes } from './resolve'
