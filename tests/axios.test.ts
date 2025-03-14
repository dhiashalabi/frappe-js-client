import axios, { AxiosInstance } from 'axios'
import { getAxiosClient, getRequestHeaders, getCSRFToken } from '../src/utils/axios'

// Mock axios module
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('Axios Utils', () => {
    // Reset all mocks before each test
    beforeEach(() => {
        // Mock window and document properly
        global.window = {
            location: {
                origin: 'https://test.example.com',
                hostname: 'test.example.com',
            },
            csrf_token: 'test-csrf-token',
        } as any as Window & typeof globalThis

        global.document = {
            querySelector: jest.fn(() => ({
                getAttribute: jest.fn().mockReturnValue('test-csrf-token'),
            })),
        } as any as Document
    })

    describe('getAxiosClient', () => {
        it('should create axios instance with basic configuration', () => {
            const appURL = 'https://test.example.com'
            mockedAxios.create.mockReturnValue({} as AxiosInstance)

            getAxiosClient(appURL)

            expect(mockedAxios.create).toHaveBeenCalledWith({
                baseURL: appURL,
                headers: expect.objectContaining({
                    Accept: 'application/json',
                    'Content-Type': 'application/json; charset=utf-8',
                }),
                withCredentials: true,
            })
        })

        it('should create axios instance with authentication token', () => {
            const appURL = 'https://test.example.com'
            const token = () => 'test-token'
            mockedAxios.create.mockReturnValue({} as AxiosInstance)

            getAxiosClient(appURL, true, token, 'Bearer')

            expect(mockedAxios.create).toHaveBeenCalledWith({
                baseURL: appURL,
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-token',
                }),
                withCredentials: true,
            })
        })

        it('should create axios instance with custom headers', () => {
            const appURL = 'https://test.example.com'
            const customHeaders = { 'Custom-Header': 'custom-value' }
            mockedAxios.create.mockReturnValue({} as AxiosInstance)

            getAxiosClient(appURL, false, undefined, undefined, customHeaders)

            expect(mockedAxios.create).toHaveBeenCalledWith({
                baseURL: appURL,
                headers: expect.objectContaining({
                    'Custom-Header': 'custom-value',
                }),
                withCredentials: true,
            })
        })
    })

    describe('getRequestHeaders', () => {
        const originalWindow = global.window

        beforeEach(() => {
            // Mock window object
            global.window = {
                location: {
                    origin: 'https://test.example.com',
                    hostname: 'test.example.com',
                },
                csrf_token: 'test-csrf-token',
            } as any as Window & typeof globalThis
        })

        afterEach(() => {
            global.window = originalWindow
        })

        it('should return basic headers without authentication', () => {
            const headers = getRequestHeaders()

            expect(headers).toEqual({
                Accept: 'application/json',
                'Content-Type': 'application/json; charset=utf-8',
                'X-Frappe-Site-Name': 'test.example.com',
                'X-Frappe-CSRF-Token': 'test-csrf-token',
            })
        })

        it('should include authentication token when specified', () => {
            const headers = getRequestHeaders(true, 'Bearer', () => 'test-token')

            expect(headers).toEqual(
                expect.objectContaining({
                    Authorization: 'Bearer test-token',
                }),
            )
        })

        it('should not include X-Frappe-Site-Name for different origins', () => {
            const headers = getRequestHeaders(false, undefined, undefined, 'https://different.example.com')

            expect(headers['X-Frappe-Site-Name']).toBeUndefined()
        })

        it('should merge custom headers', () => {
            const customHeaders = { 'Custom-Header': 'custom-value' }
            const headers = getRequestHeaders(false, undefined, undefined, undefined, customHeaders)

            expect(headers).toEqual(
                expect.objectContaining({
                    'Custom-Header': 'custom-value',
                }),
            )
        })
    })

    describe('getCSRFToken', () => {
        const originalDocument = global.document

        afterEach(() => {
            global.document = originalDocument
        })

        it('should return undefined when document is not defined', () => {
            global.document = undefined as any as Document
            expect(getCSRFToken()).toBeUndefined()
        })

        it('should return CSRF token from meta tag', () => {
            const mockMetaElement = {
                getAttribute: jest.fn().mockReturnValue('test-csrf-token'),
            }
            global.document = {
                querySelector: jest.fn().mockReturnValue(mockMetaElement),
            } as any as Document

            expect(getCSRFToken()).toBe('test-csrf-token')
        })

        it('should return undefined when meta tag is not found', () => {
            global.document = {
                querySelector: jest.fn().mockReturnValue(null),
            } as any as Document

            expect(getCSRFToken()).toBeUndefined()
        })

        it('should return undefined when content attribute is null', () => {
            const mockMetaElement = {
                getAttribute: jest.fn().mockReturnValue(null),
            }
            global.document = {
                querySelector: jest.fn().mockReturnValue(mockMetaElement),
            } as any as Document

            expect(getCSRFToken()).toBeUndefined()
        })
    })
})
