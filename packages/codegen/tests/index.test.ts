import { describe, expect, it } from 'vitest'

import * as codegen from '../src/index'

describe('package exports', () => {
    it('re-exports the programmatic API', () => {
        expect(typeof codegen.generateModule).toBe('function')
        expect(typeof codegen.generateInterface).toBe('function')
        expect(typeof codegen.toInterfaceName).toBe('function')
        expect(typeof codegen.fetchDocTypeMeta).toBe('function')
        expect(typeof codegen.fetchDocTypeMetas).toBe('function')
        expect(typeof codegen.mergeConfig).toBe('function')
        expect(typeof codegen.followChildTables).toBe('function')
        expect(typeof codegen.fetchWithOptionalFollow).toBe('function')
        expect(typeof codegen.resolveDocTypes).toBe('function')
        expect(typeof codegen.assertUniqueInterfaceNames).toBe('function')
        expect(typeof codegen.findDefaultConfigPath).toBe('function')
        expect(typeof codegen.loadConfigFile).toBe('function')
        expect(typeof codegen.DEFAULT_CONFIG_NAME).toBe('string')
        expect(codegen.DEFAULT_CONFIG_NAME).toBe('frappe-codegen.config.json')
    })
})
