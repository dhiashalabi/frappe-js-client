## [2.1.2](https://github.com/mussnad/frappe-js-client/compare/v2.1.1...v2.1.2) (2025-03-15)

### Bug Fixes

- Update API endpoint URLs to use 'https://instance.example.com' across all modules ([991e278](https://github.com/mussnad/frappe-js-client/commit/991e278a67e2d7f3a4099b4d82b71648bd1a1018))

## [2.1.1](https://github.com/mussnad/frappe-js-client/compare/v2.1.0...v2.1.1) (2025-03-15)

### Bug Fixes

- Update API endpoint URLs in FrappeClient ([3191ec3](https://github.com/mussnad/frappe-js-client/commit/3191ec3651bf0ecf67f785b37f6e964c642b6d77))

# [2.1.0](https://github.com/mussnad/frappe-js-client/compare/v2.0.0...v2.1.0) (2025-03-15)

### Features

- Enhance FrappeClient integration in FrappeApp ([0be2232](https://github.com/mussnad/frappe-js-client/commit/0be2232213e058c782b800ee4b698bb3cf798e33))
- Rename methods in FrappeClient for clarity and add new API request methods ([fdcedc9](https://github.com/mussnad/frappe-js-client/commit/fdcedc93391a072c1e745bfe5156836cfd63868e))

# [2.0.0](https://github.com/mussnad/frappe-js-client/compare/v1.6.5...v2.0.0) (2025-03-15)

### Bug Fixes

- Move Frappe response types to a new types.ts file ([5f5ece4](https://github.com/mussnad/frappe-js-client/commit/5f5ece4b105ddc8fa92edba6fb63daea47d6cba6))
- Refactor GetDocListArgs interface and update FrappeDB query parameters ([7878282](https://github.com/mussnad/frappe-js-client/commit/78782821b86385136aefc31e1d45cc2783c09133))
- Remove async from method signatures in FrappeCall, FrappeClient, and FrappeDB classes ([45d3c02](https://github.com/mussnad/frappe-js-client/commit/45d3c022d3f5bfc686541e321bd9b443d3909eb4))
- Standardize string quotes in downloadFile method ([437131c](https://github.com/mussnad/frappe-js-client/commit/437131cb0a1fd8e925c69ec9ba54bbe5a88c65e7))
- Update downloadFile method to use centralized handleRequest function ([864daa2](https://github.com/mussnad/frappe-js-client/commit/864daa291df7f86e0315cf4f1ea35124b2d8015f))

### Features

- Add FrappeFileDownload class for file download operations ([c1b0cd8](https://github.com/mussnad/frappe-js-client/commit/c1b0cd8baf70dd7b879bf7b59bcafecc55315848))
- Add Mergify configuration for automatic merging and squashing ([ebc2f3e](https://github.com/mussnad/frappe-js-client/commit/ebc2f3e8c406686c49aa0b374ff463f611fe6756))
- Added export for the client module to index.ts. ([3a37b93](https://github.com/mussnad/frappe-js-client/commit/3a37b934338a3a27db9bbf174a77db24b60c221e))
- Enhance Axios utility with request handler and error management ([c5b31d3](https://github.com/mussnad/frappe-js-client/commit/c5b31d31425978287e08e7eb9b8210754d374d0c))
- Implement FrappeClient class for API interactions ([b5b8ff4](https://github.com/mussnad/frappe-js-client/commit/b5b8ff40d8296c40ceddcce17ff677899ce0125b))
- Update error handling and request management across Frappe classes ([cb5dc1d](https://github.com/mussnad/frappe-js-client/commit/cb5dc1db288ffaf57306cf94da4a56d1677c79c5))

### BREAKING CHANGES

-   - Errors thrown from API requests now return `FrappeError` instead of `Error`.
    - This may affect existing try/catch implementations that expect standard `Error` properties like `name` or `stack`.
    - Ensure your error handling logic correctly handles `FrappeError` properties (`httpStatus`, `httpStatusText`, `exception`, etc.).

* The new `handleRequest` function replaces direct Axios calls in affected classes.
    - If you were relying on direct Axios responses or customizing Axios calls per method, you may need to update your logic.

## [1.6.5](https://github.com/mussnad/frappe-js-client/compare/v1.6.4...v1.6.5) (2025-03-14)

### Bug Fixes

- Refactor error handling in getCount method of FrappeDB class ([ba4e534](https://github.com/mussnad/frappe-js-client/commit/ba4e534c153f98c2ca6786f58e708efabb3c0649))
- Remove unnecessary blank line in FrappeDB class ([d1be08e](https://github.com/mussnad/frappe-js-client/commit/d1be08e6ed0573ecd18d9eac633ff34e84b4d37e))
- Update ESLint configuration to use CommonJS syntax ([e1ef5f8](https://github.com/mussnad/frappe-js-client/commit/e1ef5f84dc6ce0eadb9fc9f35b3b5092476cbec1))
- Update Jest configuration to use CommonJS syntax ([78319c5](https://github.com/mussnad/frappe-js-client/commit/78319c5fc10c7e029b6fe71ccd8e12bd3ecbf01c))
- Update TypeScript configurations and types ([942ee02](https://github.com/mussnad/frappe-js-client/commit/942ee0208f50eca279fe382fcf51586928998474))

## [1.6.4](https://github.com/mussnad/frappe-js-client/compare/v1.6.3...v1.6.4) (2025-03-13)

### Bug Fixes

- Remove withCredentials parameter from getLoggedInUser method ([4c0086c](https://github.com/mussnad/frappe-js-client/commit/4c0086c8aca4862f29c4c7b7c58043f970f79d77))

## [1.6.3](https://github.com/mussnad/frappe-js-client/compare/v1.6.2...v1.6.3) (2025-03-13)

### Bug Fixes

- Remove "type" field from package.json to simplify configuration ([bfd8ba4](https://github.com/mussnad/frappe-js-client/commit/bfd8ba4ceb461aa92a2a684f8d2ef89b1c5918e7))

## [1.6.2](https://github.com/mussnad/frappe-js-client/compare/v1.6.1...v1.6.2) (2025-03-13)

### Bug Fixes

- Update getLoggedInUser method to accept optional method parameter ([7b96dd6](https://github.com/mussnad/frappe-js-client/commit/7b96dd6954cb937a14c3b032c6084c5b3d479e3f))

## [1.6.1](https://github.com/mussnad/frappe-js-client/compare/v1.6.0...v1.6.1) (2025-03-13)

### Bug Fixes

- Remove semantic-release and clean up dependencies ([11213da](https://github.com/mussnad/frappe-js-client/commit/11213daa82fefb8649e9efe218fe0a4281361286))

# [1.6.0](https://github.com/mussnad/frappe-js-client/compare/v1.5.0...v1.6.0) (2025-03-13)

### Bug Fixes

- Add semantic-release and update dependencies in package.json and yarn.lock ([998600c](https://github.com/mussnad/frappe-js-client/commit/998600c85875011307ea5391240ef476eb2ac742))

### Features

- Add module type to package.json for ES module support ([80f0b1d](https://github.com/mussnad/frappe-js-client/commit/80f0b1d28646a745fd2920215d30dcbb58e13408))
- Enhance getLoggedInUser method with parameters for flexibility ([b0c62d8](https://github.com/mussnad/frappe-js-client/commit/b0c62d8acbf8aab6649123302dc72142352f12e4))
- Update dependencies and fix package.json metadata ([1cde140](https://github.com/mussnad/frappe-js-client/commit/1cde140163dd978819eff71229ee3daf51c32d29))

# [1.5.0](https://github.com/mussnad/frappe-js-client/compare/v1.4.1...v1.5.0) (2025-03-12)

### Features

- Comprehensive README update with new client features and usage examples ([f970665](https://github.com/mussnad/frappe-js-client/commit/f970665bd92501be4aaf94f93e568e3cd8240593))

## [1.4.1](https://github.com/mussnad/frappe-js-client/compare/v1.4.0...v1.4.1) (2025-03-11)

### Bug Fixes

- Clean up yarn.lock dependencies ([90f158f](https://github.com/mussnad/frappe-js-client/commit/90f158fed1dc04d06f89d694f4d311fc3070ccb5))

# [1.4.0](https://github.com/mussnad/frappe-next-sdk/compare/v1.3.7...v1.4.0) (2025-03-11)

### Features

- Update package configuration and TypeScript settings ([c8beca3](https://github.com/mussnad/frappe-next-sdk/commit/c8beca3cb8a857e6845b3ea101743a4fe76923ec))

## [1.3.7](https://github.com/mussnad/frappe-next-sdk/compare/v1.3.6...v1.3.7) (2025-03-11)

### Bug Fixes

- Remove organization scope from package name ([6a8753d](https://github.com/mussnad/frappe-next-sdk/commit/6a8753d33476c98848ce2f381bddddf752104f10))

## [1.3.6](https://github.com/mussnad/frappe-next-sdk/compare/v1.3.5...v1.3.6) (2025-03-11)

### Bug Fixes

- Simplify TypeScript and build configuration ([2441d21](https://github.com/mussnad/frappe-next-sdk/commit/2441d21b47a4d74adb430ff4d1b9109120f7da74))

## [1.3.5](https://github.com/mussnad/frappe-next-sdk/compare/v1.3.4...v1.3.5) (2025-03-11)

### Bug Fixes

- Update import paths to use relative imports ([8df6190](https://github.com/mussnad/frappe-next-sdk/commit/8df61905d42b642e561db62791ee9df475d1b498))

## [1.3.4](https://github.com/mussnad/frappe-next-sdk/compare/v1.3.3...v1.3.4) (2025-03-11)

### Bug Fixes

- Remove npm test from prepublishOnly script ([9d01e02](https://github.com/mussnad/frappe-next-sdk/commit/9d01e027254aec6982ed12e2649d50d0fc9a95b8))

## [1.3.3](https://github.com/mussnad/frappe-next-sdk/compare/v1.3.2...v1.3.3) (2025-03-11)

### Bug Fixes

- Update package scripts and configuration ([6366055](https://github.com/mussnad/frappe-next-sdk/commit/636605574065672bb08cc44d1aee90a2fc2eb9c9))

## [1.3.2](https://github.com/mussnad/frappe-next-sdk/compare/v1.3.1...v1.3.2) (2025-03-10)

### Bug Fixes

- Make package publicly publishable by removing private flag ([8dbd723](https://github.com/mussnad/frappe-next-sdk/commit/8dbd7232c275c47474503a401ce1f03823626a38))

## [1.3.1](https://github.com/mussnad/frappe-next-sdk/compare/v1.3.0...v1.3.1) (2025-03-10)

### Bug Fixes

- Add NPM package publishing to semantic-release configuration ([e93d016](https://github.com/mussnad/frappe-next-sdk/commit/e93d0165bb6f10de7c197a7dc0b8485dec866cb8))

# [1.3.0](https://github.com/mussnad/frappe-next-sdk/compare/v1.2.2...v1.3.0) (2025-03-10)

### Features

- Restore semantic-release configuration ([6808712](https://github.com/mussnad/frappe-next-sdk/commit/680871288a0cd49b5e583f91af2f8dc23582277d))

## [1.2.1](https://github.com/mussnad/frappe-next-sdk/compare/v1.2.0...v1.2.1) (2025-03-10)

### Bug Fixes

- Simplify GitHub Actions release trigger configuration ([0a0d1c8](https://github.com/mussnad/frappe-next-sdk/commit/0a0d1c8c22dc6e6a2632fab1afbc6ef8fea98bfd))

# [1.2.0](https://github.com/mussnad/frappe-next-sdk/compare/v1.1.1...v1.2.0) (2025-03-10)

### Bug Fixes

- Remove NPM package publishing configuration from semantic-release ([1e1f21f](https://github.com/mussnad/frappe-next-sdk/commit/1e1f21ff4746d33de331afd4e20243705e0061e7))

### Features

- Configure semantic-release for automated package publishing ([293eb8a](https://github.com/mussnad/frappe-next-sdk/commit/293eb8a8b1ce6fb188e2a41330a6c4bf82eda644))
- Update package name for NPM scoped package ([b58e483](https://github.com/mussnad/frappe-next-sdk/commit/b58e48320d6b8ac09035010777b7e94176b0f7cd))

## [1.1.1](https://github.com/mussnad/frappe-next-sdk/compare/v1.1.0...v1.1.1) (2025-03-10)

### Bug Fixes

- Configure NPM package for public publishing ([c143a01](https://github.com/mussnad/frappe-next-sdk/commit/c143a01b11caa17585db6613f8d12fc3194c338a))
- Update package.json for proper TypeScript module distribution ([dbc2f58](https://github.com/mussnad/frappe-next-sdk/commit/dbc2f58bbdad8279a1d66f7e816bfbf3e0ba9d83))
- Update TypeScript build config and release workflow ([5c485a3](https://github.com/mussnad/frappe-next-sdk/commit/5c485a3cc1818e2e82d735976bfce89d2ae6878a))

# [1.1.0](https://github.com/mussnad/frappe-next-sdk/compare/v1.0.0...v1.1.0) (2025-03-10)

### Features

- Add path aliases to TypeScript configuration and update import statements ([93de1c2](https://github.com/mussnad/frappe-next-sdk/commit/93de1c27392729036297bf745e7ffa5b83dc866b))

# 1.0.0 (2025-03-10)

### Features

- Initialize project structure and core SDK modules ([a960f77](https://github.com/mussnad/frappe-next-sdk/commit/a960f774dc7d099688497d0ce7ba576d6f9dec03))
