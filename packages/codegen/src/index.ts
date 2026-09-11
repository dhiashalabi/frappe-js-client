/**
 * @frappe-js-client/codegen — programmatic API. Most users want the `frappe-codegen` CLI
 * (see README.md); this entry point is for build scripts that want to generate types as part of
 * their own pipeline instead of shelling out.
 *
 * @example
 * ```ts
 * import { createFrappeClient } from 'frappe-js-client'
 * import { fetchWithOptionalFollow, generateModule } from '@frappe-js-client/codegen'
 *
 * const client = createFrappeClient({ url, apiVersion: 2, auth })
 * const metas = await fetchWithOptionalFollow(client, ['ToDo'], true)
 * const source = generateModule(metas)
 * ```
 *
 * @packageDocumentation
 */

export type { CliOverlay, CodegenFileConfig, ResolvedCodegenConfig } from './config'
export { DEFAULT_CONFIG_NAME, findDefaultConfigPath, loadConfigFile, mergeConfig } from './config'
export type { GenerateOptions } from './generate'
export { assertUniqueInterfaceNames, generateInterface, generateModule, toInterfaceName } from './generate'
export type { DocField, DocTypeMeta } from './metadata'
export { fetchDocTypeMeta, fetchDocTypeMetas } from './metadata'
export { fetchWithOptionalFollow, followChildTables, resolveDocTypes } from './resolve'
