# Frappe TS/JS SDK 🚀

A powerful and flexible SDK for integrating Frappe/ERPNext with JS/TS applications.

## 📖 Overview

This SDK provides a seamless integration between Frappe/ERPNext backend and JS/TS frontend applications, making it easier to build modern web applications with Frappe's powerful backend capabilities.

## ✨ Features

- 🔄 Seamless integration with Frappe/ERPNext
- ⚡ Built for JS/TS applications
- 🛠️ Type-safe API calls
- 🔐 Built-in authentication handling
- 📦 Easy-to-use data fetching hooks
- 🎯 Optimized for performance

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- A running Frappe/ERPNext instance
- JS/TS project

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
import { createFrappeClient } from 'frappe-js-client'

export const frappeClient = createFrappeClient({
    baseUrl: process.env.FRAPPE_URL,
    // Additional configuration options
})
```

## 💡 Usage

```typescript
import { useFrappeQuery } from 'frappe-js-client'

// In your component
const { data, isLoading, error } = useFrappeQuery('your.frappe.method', {
    // Query parameters
})
```

## 📚 Documentation

For detailed documentation and examples, please visit our [documentation](https://frappe-js-client.mussnad.dev).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Frappe Framework Team
- Next.js Team
- All contributors to this project

## 📞 Support

If you have any questions or need help, please:

- Open an issue
- Join our community discussions
- Check our documentation

---

Made with ❤️ by the Mussnad Team
