# Vendored dependency

`xlsx-0.20.3.tgz` is the unmodified SheetJS Community Edition release from:

https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

SheetJS's npm package is frozen at vulnerable version 0.18.5. Its
[official installation guide](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)
recommends the CDN release and vendoring. The local tarball allows pnpm's
`blockExoticSubdeps` protection to remain enabled while upgrading Core's dependency.
The archive contains the upstream license. pnpm-lock.yaml records its integrity.

SHA-512:

```text
a0b0eade3c3b01c2ea2961f60210a9553665f267fa5f661178ff8d7a1d12254cd5fc1759623b61f78b46e6da22301d4f3eb62dc4e09f6a850292fb6e1fedc024
```
