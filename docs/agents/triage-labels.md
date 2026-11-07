# Triage roles: Local Markdown

Пять канонических ролей Matt Pocock Skills используются как значения поля `Status:` в локальных задачах. Если skill просит применить метку triage, обновляй это поле; внешние метки не создавай.

| Роль в Matt Pocock Skills | Значение `Status:` | Значение роли |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Задача ожидает оценки сопровождающим |
| `needs-info` | `needs-info` | Нужна дополнительная информация |
| `ready-for-agent` | `ready-for-agent` | Задача достаточно определена для выполнения агентом |
| `ready-for-human` | `ready-for-human` | Для выполнения необходимо участие человека |
| `wontfix` | `wontfix` | Задача отклонена |

Пример записи в начале файла задачи: `**Status:** ready-for-agent`.

При смене роли заменяй текущее значение поля. Статусы выполнения и правила завершения описаны в [issue-tracker.md](issue-tracker.md).
