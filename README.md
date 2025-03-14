# Frappe TS/JS Client 🚀

A powerful and flexible client for integrating Frappe/ERPNext with JS/TS applications.

## 📖 Overview

This client provides a seamless integration between Frappe/ERPNext backend and JS/TS frontend applications, making it easier to build modern web applications with Frappe's powerful backend capabilities.

## ✨ Features

-   🔄 Seamless integration with Frappe/ERPNext or any other Frappe-based application
-   ⚡ Built for JS/TS applications with full type support
-   🛠️ Type-safe API calls and database operations
-   🔐 Built-in authentication handling with multiple auth methods
-   📦 Easy-to-use database operations and document management
-   📁 File upload and management capabilities
-   🎯 Optimized for performance with proper error handling

## 🚀 Getting Started

### Prerequisites

-   Node.js (v16 or higher)
-   A running Frappe/ERPNext instance
-   JS/TS project

### Installation

```bash
npm install frappe-js-client
# or
yarn add frappe-js-client
# or
pnpm add frappe-js-client
```

## 🔧 Configuration

Create a configuration file in your JS/TS project:

```typescript
// lib/frappe.ts
import { FrappeApp } from 'frappe-js-client'

// Basic initialization
const app = new FrappeApp('https://your-frappe-site.com')

// With token authentication
const authenticatedApp = new FrappeApp('https://your-frappe-site.com', {
    useToken: true,
    token: () => localStorage.getItem('token'),
    type: 'Bearer',
})

// With custom headers
const appWithHeaders = new FrappeApp('https://your-frappe-site.com', undefined, 'MyApp', {
    'Custom-Header': 'value',
})
```

## 📚 Core Features

### Authentication

```typescript
const auth = app.auth()

// Login with username and password
await auth.login('username', 'password')

// Login with OTP
await auth.loginWithOTP({
    otp: '123456',
    tmp_id: 'temp123',
    device: 'mobile',
})

// Logout
await auth.logout()
```

### Database Operations

```typescript
const db = app.db()

// Create a document
const newTask = await db.createDoc('Task', {
    subject: 'New Task',
    status: 'Open',
})

// Get a single document
const task = await db.getDoc('Task', 'TASK001')

// Get a list of documents with filters
const openTasks = await db.getDocList('Task', {
    fields: ['name', 'subject', 'status'],
    filters: [['status', '=', 'Open']],
    orderBy: { field: 'creation', order: 'desc' },
    limit: 10,
})

// Update a document
await db.updateDoc('Task', task.name, {
    status: 'Completed',
})

// Delete a document
await db.deleteDoc('Task', task.name)
```

### File Operations

```typescript
const file = app.file()

// Upload a file
const response = await file.uploadFile(fileBlob, {
    isPrivate: true,
    description: 'Document description',
    tags: ['important', 'document'],
})

// Get file URL
const fileUrl = await file.getFile('FILE001')
```

### API Calls

```typescript
const call = app.call()

// Make a GET request
const response = await call.get('frappe.ping')

// Make a POST request with data
const result = await call.post('frappe.handler', {
    data: { key: 'value' },
})
```

## 🔍 Type Safety

The SDK provides full TypeScript support with comprehensive type definitions:

```typescript
// Define custom document types
interface User
    extends FrappeDoc<{
        first_name: string
        email: string
        user_type: string
    }> {}

// Use types in operations
const user = await db.getDoc<User>('User', 'USER001')
const users = await db.getDocList<User>('User', {
    fields: ['name', 'email', 'first_name'],
})
```

## 🛡️ Error Handling

The SDK provides standardized error handling:

```typescript
try {
    await db.createDoc('Task', { subject: 'New Task' })
} catch (error) {
    const frappeError = error as Error
    console.error(`${frappeError.httpStatus}: ${frappeError.message}`)
    // Handle specific error types
    if (frappeError.exception === 'ValidationError') {
        // Handle validation errors
    }
}
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you have any questions or need help, please:

-   Open an issue
-   Join our community discussions
-   Check our documentation

---

Made with ❤️ by the Mussnad Team
