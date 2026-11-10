# Чувствительность теста пересечений

10 ноября 2026 года для [#50](https://github.com/skaffman41/ai-for-developers-project-386/issues/50)
подтверждён критерий AC5 [спецификации #48](https://github.com/skaffman41/ai-for-developers-project-386/issues/48).
Полные команды, коды завершения, временный diff и журналы сборок и red/green сохранены
в [доказательстве эксперимента](https://github.com/skaffman41/ai-for-developers-project-386/issues/50#issuecomment-6768301549).

Проверенная база — `6d006a29bbb568f647b6bdcd24bf4abd07969439`. Эксперимент проведён
в отдельной рабочей копии с новой файловой SQLite и backend на свободном локальном
порту для каждого запуска. Существующий HTTP-тест
`concurrent overlapping types have one winner, exact concurrent retries and touching boundaries`
в `tests/confirm-booking.test.ts` отправляет встречи разных типов на 06:00–06:45
и 06:30–07:00 UTC и ожидает один `201` и один `409`.

Временная мутация ограничила SQL-поиск пересечений типом встречи. После успешной
сборки тест завершился с кодом **1** на ожидании `[201, 409]`: сервер вернул
`[201, 201]`. После побайтового восстановления правильной реализации и повторной
сборки та же команда завершилась с кодом **0** (1 passed, 36 skipped):

```sh
mise exec -- npm exec -- vitest run tests/confirm-booking.test.ts -t 'concurrent overlapping types have one winner, exact concurrent retries and touching boundaries'
```

Правило [ADR 0003](adr/0003-booking-storage.md) сохранено: пересечение полного
интервала запрещено независимо от типа встречи, соприкасающиеся границы разрешены.
Мутация удалена до коммита; тесты и реализация не изменены. Это локальное
доказательство указанной базы. Итог обязательного полного `mise run check`, SHA
коммита отчёта и локальная готовность приведены в Answer #50; удалённый CI
дополнения подтверждается после отдельно разрешённой публикации.
