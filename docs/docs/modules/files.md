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
        signal,
        requestId: 'upload-1',
    },
)

const blob = await frappe.file.download('/files/spec.pdf')
```

`download` uses `responseType: 'arraybuffer'` and returns a `Blob`. JSON error bodies in that buffer are still `FrappeError`.

## Input types

`FrappeUploadInput`: `Blob | File | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>`.

Node `Buffer` is a `Uint8Array`, so it is assignable without appearing in the public `.d.ts` (that would force `@types/node` on browser consumers). `ReadableStream` inputs are buffered into a `Blob` first — progress on those is best-effort, not byte-accurate.

## Upload options vs `RequestOptions`

`UploadOptions` has `onProgress`, `signal`, `timeout`, `headers`, `requestId`, `apiPath`, `filename`. It does **not** have `deadline`.

`onProgress` cannot be used together with client middleware (`ConfigurationError`). See [Middleware](../middleware.md).
