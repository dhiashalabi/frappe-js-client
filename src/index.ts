/**
 * @module frappe-js-client
 * @description A modern TypeScript SDK for Frappe Framework, providing strongly-typed
 * interfaces and utilities for interacting with Frappe-based applications.
 *
 * This module serves as the main entry point for the Frappe Next SDK, exposing all
 * essential functionalities through organized submodules.
 *
 * @example
 * ```typescript
 * import { FrappeApp, Auth, DB } from 'frappe-js-client';
 *
 * // Initialize the Frappe application
 * const frappe = new FrappeApp({
 *   url: 'https://your-frappe-site.com'
 * });
 * ```
 *
 * @packageDocumentation
 *
 * Exports:
 * - {@link "./frappe"} - Core Frappe application functionality
 * - {@link "./auth"} - Authentication and user management
 * - {@link "./db"} - Database operations and queries
 * - {@link "./file"} - File handling utilities
 * - {@link "./call"} - Remote method calling utilities
 *
 * @license MIT
 */

export * from './frappe'
export * from './auth'
export * from './db'
export * from './file'
export * from './call'
export * from './client'
