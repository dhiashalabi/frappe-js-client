/**
 * @module file/types
 * @description Type definitions for Frappe file upload operations.
 * These types define the structure of file upload requests and their associated metadata.
 *
 * @packageDocumentation
 */

/**
 * Configuration options for file upload operations.
 *
 * @interface FileArgs
 * @description Defines the structure for configuring file uploads in Frappe.
 * Supports generic type T for additional custom data that may be required during upload.
 *
 * @template T - Type of additional data to be sent with the file upload
 *
 * @example
 * ```typescript
 * interface CustomData {
 *   description: string;
 *   tags: string[];
 * }
 *
 * const args: FileArgs<CustomData> = {
 *   isPrivate: true,
 *   folder: "Home/Documents",
 *   doctype: "File",
 *   otherData: {
 *     description: "Important document",
 *     tags: ["important", "document"]
 *   }
 * };
 * ```
 */
export interface FileArgs<T> {
    /** If the file access is private then set to TRUE */
    isPrivate?: boolean
    /** Folder the file exists in */
    folder?: string
    /** File URL */
    file_url?: string
    /** Doctype associated with the file */
    doctype?: string
    /** Docname associated with the file */
    docname?: string
    /** Field to be linked in the Document */
    fieldname?: string
    /** Additional data to be sent along with the file */
    otherData?: T
}
