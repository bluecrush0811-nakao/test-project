---
date: <% tp.date.now("YYYY-MM-DD") %>
tags: [daily]
---

# <% tp.date.now("YYYY-MM-DD (dddd)") %>

## やること

- [ ]

## メモ



## 今日作成したノート

```dataview
LIST
FROM ""
WHERE file.cday = date(<% tp.date.now("YYYY-MM-DD") %>)
SORT file.ctime ASC
```
