---
tags: [meta]
---

# Welcome

このノートは Obsidian vault の動作確認用サンプルです。

## Dataview の例

```dataview
TABLE tags AS "タグ"
FROM "notes"
SORT file.name ASC
```

## Templater の例

デイリーノート（`daily/` フォルダ）を新規作成すると、
`templates/Daily Note Template.md` が自動的に適用されます。
