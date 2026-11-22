# ts-packwerk

Packs for TypeScript, after Shopify's [Packwerk](https://github.com/Shopify/packwerk). A pack is a folder with a `pack.yml`. It owns every file under it, down to the next pack. ts-packwerk reads every import, resolves it the way TypeScript and Node do, and reports the ones that break a pack's rules.

`package.json` already governs references between workspace packages. `pack.yml` governs references inside one package, where an `@/*` path alias otherwise lets any file reach any other.

## Run it

```sh
node tooling/ts-packwerk/src/cli.ts check          # new violations and stale todos fail
node tooling/ts-packwerk/src/cli.ts update-todo    # remove fixed violations from pack_todo.yml
node tooling/ts-packwerk/src/cli.ts update-todo --all  # record every violation, once, when adopting packs
node tooling/ts-packwerk/src/cli.ts explain <pack> # what a pack enforces, uses and is used by
```

## packwerk.yml

```yaml
include: ["apps/*/src/**/*.{ts,tsx}"]
exclude: ["**/*.test.ts"]
layers: [app, legacy, feature, platform] # top to bottom; a pack may use its own layer or lower
table_exempt: ["src/migrations.ts"] # files that may name any table, such as migrations
```

## pack.yml

```yaml
layer: feature
dependencies: [apps/web/src/design] # packs this pack may use, by folder
public: [index.ts] # files other packs may import; default index.ts or src/index.ts
enforce_dependencies: true # each rule defaults to true
enforce_privacy: true
enforce_layers: true
owns_tables: [deck.doom] # SQL tables only this pack's files may name
```

## Rules

| Rule         | Fails when                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dependency` | a file uses a pack in the same package that its pack does not list                                                                                         |
| `privacy`    | a file imports another pack's file that is not public                                                                                                      |
| `layer`      | a pack uses a pack in a higher layer                                                                                                                       |
| `table`      | a string or template literal names a table that another pack owns                                                                                          |
| `cycle`      | pack dependencies form a cycle                                                                                                                             |
| `package`    | an import names a package missing from the nearest `package.json`, a runtime import names a devDependency, or a relative path reaches into another package |

`dependency`, `privacy` and `layer` violations can be recorded in a pack's `pack_todo.yml`. A recorded violation passes; a fixed one still listed fails as stale until `update-todo` removes it. `update-todo` never records a new violation, so the file only shrinks.

Type-only imports count, since they couple packs too. Dynamic `import()` counts when its argument is a string literal.
