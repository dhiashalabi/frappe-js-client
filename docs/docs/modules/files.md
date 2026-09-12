# Files

`frappe.file.upload` is **POST** multipart to `upload_file` (override with `apiPath`). Files are **private by default** (`is_private=1`). Pass `isPrivate: false` for a public `/files/` URL. `otherData` cannot override `is_private`. `docName` is sent as wire `docname` so it is not confused with the File document's `name`.

```typescript
const uploaded = await frappe.file.upload(file, {
    isPrivate: true,
    folder: 'Home',
    fileUrl: undefined,
    doctype: 'ToDo',
    docName: 'abc',
    fieldName: 'attachment',
    otherData: { comment: 'spec' },
})

await frappe.file.upload(
    file,
    { isPrivate: false },
    {
        onProgress: ({ loaded, total }) => {
            console.log(total ? loaded / total : loaded)
        },
        filename: 'spec.pdf',
        timeout: 60_000,
        deadline: Date.now() + 120_000,
        signal,
        requestId: 'upload-1',
    },
)

const blob = await frappe.file.download('/files/spec.pdf')
```

## Methods

| Method                         | Returns                 | Notes                                                  |
| ------------------------------ | ----------------------- | ------------------------------------------------------ |
| `upload(file, args, options?)` | `FileDoc` (generic `T`) | Multipart POST with upload-specific request options    |
| `download(fileURL, options?)`  | `Blob`                  | Classic `download_file`. `responseType: 'arraybuffer'` |

`download` uses `responseType: 'arraybuffer'` and returns a `Blob`. JSON error bodies in that buffer are still `FrappeError`.

## `FileArgs`

| Field                 | Wire                  | Default                                        |
| --------------------- | --------------------- | ---------------------------------------------- |
| `isPrivate`           | `is_private`          | `true` (`1`)                                   |
| `folder`              | `folder`              | —                                              |
| `fileUrl`             | `file_url`            | —                                              |
| `doctype` + `docName` | `doctype` / `docname` | Both required together to attach               |
| `fieldName`           | `fieldname`           | Only sent when attaching to a doc              |
| `otherData`           | extra form fields     | Keys named `is_private` (any case) are ignored |

## Input types

`FrappeUploadInput`: `Blob | File | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>`.

Node `Buffer` is a `Uint8Array`, so it is assignable without appearing in the public `.d.ts` (that would force `@types/node` on browser consumers). `ReadableStream` inputs are buffered into a `Blob` first — progress on those is best-effort, not byte-accurate. Cancellation and the deadline also apply while that stream is being buffered. Unsupported inputs throw `TypeError`.

Default filename: `File.name` if the input is a `File`, otherwise `upload.bin` (or `options.filename`).

## Upload options vs `RequestOptions`

`UploadOptions` has `onProgress`, `signal`, `timeout`, `deadline`, `headers`, `requestId`, `apiPath`, `filename`. `deadline` is an absolute Unix timestamp in milliseconds. `apiPath` defaults to `upload_file`.

`onProgress` cannot be used together with client middleware (`ConfigurationError`). See [Middleware](../middleware.md).

Without `XMLHttpRequest`, progress is 0% then 100% around `fetch`.

## `FileDoc`

Typical fields on the created File record: `name`, `file_name`, `file_url`, `is_private` (`0 | 1`), `file_size?`, `folder?`, `attached_to_doctype?`, `attached_to_name?`, `attached_to_field?`.
