/**
 * @module file
 * @description Provides functionality for file upload operations in Frappe.
 * This module handles file uploads with progress tracking, authentication,
 * and custom metadata support.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { FrappeApp } from '@frappe/sdk';
 *
 * const app = new FrappeApp('https://erp.example.com');
 * const fileUploader = app.file();
 *
 * // Upload a file with progress tracking
 * await fileUploader.uploadFile(
 *   fileBlob,
 *   {
 *     isPrivate: true,
 *     folder: 'Home/Documents'
 *   },
 *   (uploaded, total) => {
 *     console.log(`Progress: ${(uploaded/total) * 100}%`);
 *   }
 * );
 * ```
 */

import { AxiosInstance, AxiosProgressEvent } from 'axios'

import { Error } from '../frappe/types'
import { FileArgs } from './types'
import { getRequestHeaders } from '../utils/axios'

/**
 * Handles file upload operations for Frappe.
 *
 * @class FrappeFileUpload
 * @description Provides methods for uploading files to a Frappe instance with
 * support for progress tracking, authentication, and custom metadata.
 *
 * @example
 * ```typescript
 * const uploader = new FrappeFileUpload(
 *   'https://erp.example.com',
 *   axiosInstance,
 *   true,
 *   () => localStorage.getItem('token'),
 *   'Bearer'
 * );
 *
 * // Upload a file
 * const response = await uploader.uploadFile(
 *   file,
 *   { isPrivate: true }
 * );
 * ```
 */
export class FrappeFileUpload {
    /** URL of the Frappe App instance */
    private readonly appURL: string

    /** Axios instance for making HTTP requests */
    readonly axios: AxiosInstance

    /** Whether to use token based authentication */
    readonly useToken: boolean

    /** Function that returns the authentication token */
    readonly token?: () => string

    /** Type of token to be used for authentication */
    readonly tokenType?: 'Bearer' | 'token'

    /** Custom headers to be included in requests */
    readonly customHeaders?: object

    /**
     * Creates a new FrappeFileUpload instance.
     *
     * @param appURL - Base URL of the Frappe instance
     * @param axios - Configured Axios instance for making requests
     * @param useToken - Whether to use token-based authentication
     * @param token - Function that returns the authentication token
     * @param tokenType - Type of token to use ('Bearer' or 'token')
     * @param customHeaders - Additional headers to include in requests
     *
     * @example
     * ```typescript
     * const uploader = new FrappeFileUpload(
     *   'https://erp.example.com',
     *   axiosInstance,
     *   true,
     *   () => localStorage.getItem('token'),
     *   'Bearer'
     * );
     * ```
     */
    constructor(
        appURL: string,
        axios: AxiosInstance,
        useToken?: boolean,
        token?: () => string,
        tokenType?: 'Bearer' | 'token',
        customHeaders?: object,
    ) {
        this.appURL = appURL
        this.axios = axios
        this.useToken = useToken ?? false
        this.token = token
        this.tokenType = tokenType
        this.customHeaders = customHeaders
    }

    /**
     * Uploads a file to the Frappe instance with optional progress tracking.
     *
     * @template T - Type of additional data to be sent with the file
     * @param file - The file to upload
     * @param args - Configuration options for the upload
     * @param onProgress - Optional callback for tracking upload progress
     * @param apiPath - Optional custom API endpoint path (defaults to 'upload_file')
     *
     * @returns Promise that resolves with the upload response
     * @throws {Error} If the upload fails
     *
     * @example
     * ```typescript
     * // Basic file upload
     * const response = await uploader.uploadFile(
     *   file,
     *   { isPrivate: true }
     * );
     *
     * // Upload with progress tracking
     * const response = await uploader.uploadFile(
     *   file,
     *   { folder: 'Home/Documents' },
     *   (uploaded, total) => {
     *     console.log(`Progress: ${(uploaded/total) * 100}%`);
     *   }
     * );
     *
     * // Upload with custom metadata
     * interface CustomData {
     *   category: string;
     * }
     *
     * const response = await uploader.uploadFile<CustomData>(
     *   file,
     *   {
     *     doctype: 'File',
     *     docname: 'FILE-001',
     *     otherData: { category: 'Important' }
     *   }
     * );
     * ```
     */
    async uploadFile(
        file: File,
        args: FileArgs,
        onProgress?: (bytesUploaded: number, totalBytes?: number, progress?: AxiosProgressEvent) => void,
        apiPath = 'upload_file',
    ) {
        const formData = new FormData()
        if (file) formData.append('file', file, file.name)

        const { isPrivate, folder, file_url, doctype, docname, fieldname, otherData } = args

        if (isPrivate) {
            formData.append('is_private', '1')
        }
        if (folder) {
            formData.append('folder', folder)
        }
        if (file_url) {
            formData.append('file_url', file_url)
        }
        if (doctype && docname) {
            formData.append('doctype', doctype)
            formData.append('docname', docname)
            if (fieldname) {
                formData.append('fieldname', fieldname)
            }
        }

        if (otherData) {
            Object.keys(otherData).forEach((key) => {
                const v = otherData[key]
                formData.append(key, v)
            })
        }

        return this.axios
            .post(`/api/method/${apiPath}`, formData, {
                onUploadProgress: (progressEvent) => {
                    if (onProgress) {
                        onProgress(progressEvent.loaded, progressEvent.total, progressEvent)
                    }
                },
                headers: {
                    ...getRequestHeaders(this.useToken, this.tokenType, this.token, this.appURL, this.customHeaders),
                    'Content-Type': 'multipart/form-data',
                },
            })
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: error.response.data.message ?? 'There was an error while uploading the file.',
                    exception: error.response.data.exception ?? '',
                } as Error
            })
    }
}

/**
 * Handles file download operations for Frappe.
 *
 * @class FrappeFileDownload
 * @description Provides methods for downloading files from a Frappe instance.
 *
 * @example
 * ```typescript
 * const downloader = new FrappeFileDownload(axiosInstance)
 * const response = await downloader.downloadFile('https://erp.example.com/files/test.pdf')
 * ```
 */
export class FrappeFileDownload {
    constructor(private readonly axios: AxiosInstance) {}

    /**
     * Downloads a file from the Frappe instance.
     *
     * @param fileURL - The URL of the file to download
     * @returns Promise that resolves with the download response
     * @throws {Error} If the download fails
     */
    async downloadFile(fileURL: string): Promise<void> {
        const response = await this.axios.get(`/api/method/download_file`, {
            params: {
                file_url: fileURL,
            },
        })
        return response.data
    }
}
