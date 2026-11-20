# A trait's stored fields never change without a higher stamp, so the stored format rises and an older tab reloads before it reads a row it cannot

`packages/document/src/trait-format.test.ts` hashes each trait's fields against its stamp and keeps every shape a stamp ever had, so a changed field names the version to write
