# Frappe JS Client

[![npm version](https://badge.fury.io/js/frappe-js-client.svg)](https://badge.fury.io/js/frappe-js-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A modern, type-safe TypeScript/JavaScript client for Frappe Framework applications. Built with Axios for robust HTTP communication and comprehensive error handling.

## 📋 Table of Contents

- [Frappe JS Client](#frappe-js-client)
    - [📋 Table of Contents](#-table-of-contents)
    - [✨ Features](#-features)
    - [📦 Installation](#-installation)
    - [🚀 Quick Start](#-quick-start)
    - [📚 API Reference](#-api-reference)
        - [FrappeApp](#frappeapp)
            - [Parameters](#parameters)
            - [Methods](#methods)
    - [🔐 Authentication](#-authentication)
        - [Basic Authentication](#basic-authentication)
        - [Token-Based Authentication](#token-based-authentication)
    - [🗄️ Database Operations](#️-database-operations)
        - [Document Operations](#document-operations)
        - [Advanced Filtering](#advanced-filtering)
    - [📁 File Operations](#-file-operations)
        - [File Upload](#file-upload)
        - [File Download](#file-download)
    - [🌐 API Calls](#-api-calls)
        - [HTTP Methods](#http-methods)
    - [🛡️ Error Handling](#️-error-handling)
    - [🔧 TypeScript Support](#-typescript-support)
        - [Custom Document Types](#custom-document-types)
        - [API Response Types](#api-response-types)
    - [📖 Examples](#-examples)
        - [Complete Application Example](#complete-application-example)
        - [React Hook Example](#react-hook-example)
    - [🤝 Contributing](#-contributing)
        - [Development Setup](#development-setup)
    - [📄 License](#-license)
    - [🆘 Support](#-support)

## ✨ Features

- 🔐 **Authentication**: Multiple auth methods (username/password, OTP, token-based)
- 🗄️ **Database Operations**: Full CRUD operations with filtering, sorting, and pagination
- 📁 **File Management**: Upload, download, and manage files with progress tracking
- 🌐 **API Integration**: Direct access to Frappe API endpoints
- 🛡️ **Type Safety**: Full TypeScript support with comprehensive type definitions
- ⚡ **Performance**: Built on Axios with optimized request handling
- 🔄 **Error Handling**: Standardized error responses and handling
- 🎯 **Permission System**: Built-in permission checking and management

## 📦 Installation

```bash
npm install frappe-js-client
# or
yarn add frappe-js-client
# or
pnpm add frappe-js-client
```

## 🚀 Quick Start

```typescript
import { FrappeApp } from 'frappe-js-client'

// Initialize the client
const app = new FrappeApp('https://your-frappe-site.com')

// Authenticate
const auth = app.auth()
await auth.loginWithUsernamePassword({
    username: 'admin',
    password: 'password',
    device: 'desktop',
})

// Database operations
const db = app.db()
const users = await db.getDocList('User', {
    fields: ['name', 'email', 'first_name'],
    filters: [['user_type', '=', 'System User']],
    limit: 10,
})

// File operations
const file = app.file()
const uploadResult = await file.uploadFile(fileBlob, {
    isPrivate: true,
    folder: 'Home/Documents',
})

// API calls
const call = app.call()
const response = await call.get('frappe.ping')
```

## 📚 API Reference

### FrappeApp

The main class for interacting with a Frappe instance.

```typescript
class FrappeApp {
    constructor(url: string, tokenParams?: TokenParams, name?: string, customHeaders?: object)
}
```

#### Parameters

- `url` (string): The base URL of your Frappe instance
- `tokenParams` (optional): Configuration for token-based authentication
- `name` (optional): Name for the app instance (defaults to 'FrappeApp')
- `customHeaders` (optional): Custom headers to include in all requests

#### Methods

- `auth()`: Returns authentication handler
- `db()`: Returns database operations handler
- `file()`: Returns file operations handler
- `call()`: Returns API call handler
- `client()`: Returns client operations handler
- `perms()`: Returns permission handler

## 🔐 Authentication

### Basic Authentication

```typescript
const auth = app.auth()

// Login with username and password
const response = await auth.loginWithUsernamePassword({
    username: 'admin',
    password: 'password',
    device: 'desktop',
})

// Login with OTP
const otpResponse = await auth.loginWithUsernamePassword({
    otp: '123456',
    tmp_id: 'temp123',
    device: 'mobile',
})

// Get current user
const currentUser = await auth.getLoggedInUser()

// Logout
await auth.logout()

// Password reset
await auth.forgetPassword('admin@example.com')
```

### Token-Based Authentication

```typescript
// Initialize with token authentication
const app = new FrappeApp('https://your-site.com', {
    useToken: true,
    token: () => localStorage.getItem('token'),
    type: 'Bearer',
})
```

## 🗄️ Database Operations

### Document Operations

```typescript
const db = app.db()

// Get a single document
const user = await db.getDoc('User', 'administrator')

// Get document list with filters
const tasks = await db.getDocList('Task', {
    fields: ['name', 'subject', 'status', 'assigned_to'],
    filters: [['status', '=', 'Open']],
    orderBy: { field: 'creation', order: 'desc' },
    limit: 20,
})

// Create a new document
const newTask = await db.createDoc('Task', {
    subject: 'New Task',
    status: 'Open',
    description: 'Task description',
})

// Update a document
await db.updateDoc('Task', newTask.name, {
    status: 'Completed',
    completed_on: new Date().toISOString(),
})

// Delete a document
await db.deleteDoc('Task', newTask.name)

// Get the last document
const lastTask = await db.getLastDoc('Task', {
    filters: [['status', '=', 'Open']],
})
```

### Advanced Filtering

```typescript
// Complex filters
const filteredDocs = await db.getDocList('Task', {
    filters: [
        ['status', '=', 'Open'],
        ['priority', 'in', ['High', 'Medium']],
        ['creation', '>=', '2024-01-01'],
    ],
    orFilters: [
        ['assigned_to', '=', 'admin'],
        ['owner', '=', 'admin'],
    ],
    groupBy: 'status',
    limit: 50,
})
```

## 📁 File Operations

### File Upload

```typescript
const file = app.file()

// Basic file upload
const uploadResult = await file.uploadFile(fileBlob, {
    isPrivate: true,
    folder: 'Home/Documents',
})

// Upload with progress tracking
const result = await file.uploadFile(fileBlob, { isPrivate: false }, (uploaded, total) => {
    const progress = (uploaded / total) * 100
    console.log(`Upload progress: ${progress.toFixed(2)}%`)
})

// Upload with custom metadata
const response = await file.uploadFile(fileBlob, {
    doctype: 'Task',
    docname: 'TASK-001',
    fieldname: 'attachment',
    otherData: {
        category: 'Important',
        tags: 'urgent,review',
    },
})
```

### File Download

```typescript
const downloader = new FrappeFileDownload(axiosInstance)
const fileBlob = await downloader.downloadFile('https://your-site.com/files/document.pdf')
```

## 🌐 API Calls

### HTTP Methods

```typescript
const call = app.call()

// GET request
const response = await call.get('frappe.ping')

// GET with parameters
const users = await call.get('frappe.user.get_users', {
    filters: { user_type: 'System User' },
    limit: 10,
})

// POST request
const result = await call.post('frappe.handler', {
    data: { key: 'value' },
})

// PUT request
await call.put('frappe.user.update_prefs', {
    user: 'admin',
    preferences: { theme: 'dark' },
})

// DELETE request
await call.delete('frappe.user.delete_user', {
    user: 'test_user',
})
```

## 🛡️ Error Handling

The SDK provides standardized error handling with detailed error information:

```typescript
try {
    await db.createDoc('Task', { subject: 'New Task' })
} catch (error) {
    const frappeError = error as Error

    console.error(`HTTP Status: ${frappeError.httpStatus}`)
    console.error(`Message: ${frappeError.message}`)
    console.error(`Exception: ${frappeError.exception}`)

    // Handle specific error types
    switch (frappeError.exception) {
        case 'ValidationError':
            // Handle validation errors
            break
        case 'PermissionError':
            // Handle permission errors
            break
        case 'DoesNotExistError':
            // Handle not found errors
            break
    }
}
```

## 🔧 TypeScript Support

### Custom Document Types

```typescript
import { FrappeDoc } from 'frappe-js-client'

// Define custom document interface
interface Task
    extends FrappeDoc<{
        subject: string
        status: 'Open' | 'In Progress' | 'Completed'
        priority: 'Low' | 'Medium' | 'High'
        assigned_to?: string
        description?: string
        due_date?: string
    }> {}

// Use typed operations
const task = await db.getDoc<Task>('Task', 'TASK-001')
const tasks = await db.getDocList<Task>('Task', {
    filters: [['status', '=', 'Open']],
})
```

### API Response Types

```typescript
interface LoginResponse {
    message: string
    home_page: string
    user: string
}

const response = await auth.loginWithUsernamePassword<LoginResponse>({
    username: 'admin',
    password: 'password',
})
```

## 📖 Examples

### Complete Application Example

```typescript
import { FrappeApp } from 'frappe-js-client'

class TaskManager {
    private app: FrappeApp
    private db: any
    private auth: any

    constructor(frappeUrl: string) {
        this.app = new FrappeApp(frappeUrl)
        this.db = this.app.db()
        this.auth = this.app.auth()
    }

    async initialize() {
        // Authenticate
        await this.auth.loginWithUsernamePassword({
            username: 'admin',
            password: 'password',
        })
    }

    async createTask(subject: string, description?: string) {
        return await this.db.createDoc('Task', {
            subject,
            description,
            status: 'Open',
            priority: 'Medium',
        })
    }

    async getOpenTasks() {
        return await this.db.getDocList('Task', {
            fields: ['name', 'subject', 'status', 'priority'],
            filters: [['status', '=', 'Open']],
            orderBy: { field: 'creation', order: 'desc' },
        })
    }

    async completeTask(taskName: string) {
        return await this.db.updateDoc('Task', taskName, {
            status: 'Completed',
            completed_on: new Date().toISOString(),
        })
    }
}

// Usage
const taskManager = new TaskManager('https://your-frappe-site.com')
await taskManager.initialize()

const newTask = await taskManager.createTask('Implement new feature')
const openTasks = await taskManager.getOpenTasks()
await taskManager.completeTask(newTask.name)
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react'
import { FrappeApp } from 'frappe-js-client'

const useFrappeClient = (url: string) => {
    const [app] = useState(() => new FrappeApp(url))
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const auth = app.auth()
                const user = await auth.getLoggedInUser()
                setIsAuthenticated(!!user)
            } catch {
                setIsAuthenticated(false)
            }
        }
        checkAuth()
    }, [app])

    return { app, isAuthenticated }
}
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/dhiashalabi/frappe-js-client.git

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run linting
npm run lint
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 **Issues**: [GitHub Issues](https://github.com/dhiashalabi/frappe-js-client/issues)
- 📖 **Documentation**: [GitHub Wiki](https://github.com/dhiashalabi/frappe-js-client/wiki)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/dhiashalabi/frappe-js-client/discussions)

---

Made with ❤️ by the [DHia A. SHalabi](https://github.com/dhiashalabi)
