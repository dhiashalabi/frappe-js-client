/**
 * @module file/types
 * @description Type definitions for Frappe file upload operations.
 * These types define the structure of file upload requests and their associated metadata.
 *
 * @packageDocumentation
 */

/**
 * Additional metadata that can be sent with file uploads
 */
export interface FileMetadata {
    description?: string
    tags?: string[]
    [key: string]: any
}

/** Configuration options for file upload operations */
export type FileArgs = {
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
    otherData?: { [key: string]: string | Blob }
}
