# Cyberpunk2020VTT -> FoundryVTT V13/V14: актуальный техдолг

Дата сверки: 2026-05-31.

Этот документ оставляет только актуальные риски относительно текущей кодовой базы. Уже исправленные пункты удалены: `mergeObject`, `isObjectEmpty`, `isNewerVersion`, `game.system.data.version`, базовые fallback-и `game.model`, `CONST.CHAT_MESSAGE_STYLES`, NeDB `.db` паки.

## Текущий статус

| Область | Статус | Важность |
|---|---|---|
| V13 запуск | `system.json` допускает V13 (`maximum: "13"`), но `verified` еще `"12"` | Средняя |
| V14 запуск | `maximum: "13"` блокирует V14 | Высокая |
| Sheet framework | `ActorSheet`, `ItemSheet`, `FormApplication` остаются ApplicationV1 | Высокая |
| Sheet events | `html.find().click/change/bind` остаются jQuery-style | Высокая |
| Legacy dialogs | `Dialog` используется в двух местах | Средняя |
| Миграции | Остались legacy `data:` и fallback-и на старые token/template API | Средняя |
| Roll API | Используется приватное `Roll._evaluated` | Средняя |
| CSS | Стили не адаптированы под cascade layers и местами глобальны | Средняя |
| Packs | Уже LevelDB-директории, не `.db` | Низкая |

## Блокеры и важные риски

### 1. ApplicationV1 sheet classes

Остаются старые базовые классы:

- `module/actor/actor-sheet.js`: `CyberpunkActorSheet extends ActorSheet`
- `module/item/item-sheet.js`: `CyberpunkItemSheet extends ItemSheet`
- `module/dialog/modifiers.js`: `ModifiersDialog extends FormApplication`

Для полноценной V13/V14 совместимости нужно мигрировать:

- actor sheet -> `HandlebarsApplicationMixin(ActorSheetV2)`
- item sheet -> `HandlebarsApplicationMixin(ItemSheetV2)`
- modifiers dialog -> `HandlebarsApplicationMixin(ApplicationV2)` или `DialogV2`/custom form flow

Связанные изменения:

- `static get defaultOptions()` -> `static DEFAULT_OPTIONS`
- `getData()` -> `_prepareContext(options)`
- `_updateObject(event, formData)` -> новый submit flow
- `activateListeners(html)` -> actions/events через native DOM
- `render(true)` -> `render({ force: true })`
- `this.object` -> `this.document`/context state

### 2. jQuery-style listeners in sheets

`activateListeners(html)` все еще ожидает jQuery-like `html`.

Затронуто:

- `module/actor/actor-sheet.js`: `.stat-roll`, `.skill-level`, `.chip-toggle`, `.skill-sort`, `.skill-roll`, `.roll-initiative`, `.damage`, `.stun-death-save`, `.item-roll`, `.item-edit`, `.item-delete`, `.rc-item-delete`, `.fire-weapon`
- `module/item/item-sheet.js`: `this.element.find(".sheet-body")`, `.item-roll`, `.accel`, `.decel`, `.humanity-cost-roll`

Минимальный временный фикс для V13: нормализовать `html` к jQuery-обертке, если jQuery доступен. Правильный фикс: native DOM listeners или ApplicationV2 actions.

### 3. Legacy `Dialog`

`Dialog` остался здесь:

- `module/actor/actor-sheet.js`: подтверждение удаления предмета
- `module/item/item.js`: подтверждение применения combat outcome

Нужно заменить на `foundry.applications.api.DialogV2`.

Отдельно проверить XSS: оба места формируют HTML через interpolated user-controlled values (`item.name`, target names/warnings). Перед выводом нужен escape/sanitization.

### 4. `ModifiersDialog` submit recursion

`module/dialog/modifiers.js`:

```js
_updateObject(event, formData) {
  this.object = formData;
  this.submit().then(...)
}
```

`submit()` вызывает `_updateObject()` снова -> риск бесконечной рекурсии. Нужно вызывать `this.options.onConfirm(formData)` напрямую и закрывать форму без повторного submit.

### 5. Приватный Roll API

`module/dice.js` использует:

```js
if (!r._evaluated) {
  return await r.evaluate();
}
```

`_evaluated` приватный. Заменить на публичный API: `r.evaluated` если доступен, либо совместимый fallback по `r.total === null`.

### 6. Legacy миграция навыков

`module/migrate.js`, `convertOldSkill()` возвращает:

```js
{ name, type: "skill", data: { ... } }
```

Для современных Foundry data model нужно:

```js
{ name, type: "skill", system: { ... } }
```

Это важно для старых миров, где hardcoded skills мигрируют в Item skills.

### 7. Fallback-и на старые API в миграциях

Часть старых API уже заменена, но в коде оставлены fallback-и:

- `actor.prototypeToken || actor.token`
- `game.model?.Item?... || game.system?.template?...`
- `game.model?.Actor || game.system?.template?.Actor`

Это не блокирует V13, но удерживает legacy paths. После выбора целевой версии (`minimum: 12` или `minimum: 13`) fallback-и лучше убрать или изолировать в compat helpers.

### 8. Sheet registration

`module/cyberpunk2020-rilerena.js` использует:

```js
Actors.unregisterSheet("core", ActorSheet);
Actors.registerSheet(game.system.id, CyberpunkActorSheet, ...);
Items.unregisterSheet("core", ItemSheet);
Items.registerSheet(game.system.id, CyberpunkItemSheet, ...);
```

При миграции на ApplicationV2 проверить актуальный способ регистрации V2 document sheets и отсутствие fallback на core V1 sheets.

### 9. Direct system mutation

Есть прямые записи в `system`, которые плохо сочетаются с modern DataModel:

- `module/item/item-sheet.js`: результат humanity loss пишется напрямую в `cyber.system.humanityLoss`
- `module/actor/actor.js`: derived values пишутся в `this.system`

Нужно разделить persisted fields и derived/transient state. Persisted -> `update()`. Derived -> `prepareDerivedData()`/transient view model.

### 10. CSS layers and global selectors

V13 усиливает значение cascade layers. Текущие SCSS/CSS переопределяют Foundry selectors и содержат глобальные правила.

Проверить:

- `.sheet`, `.window-app`, `.app`, `.dialog`, `.form-group`
- `.inactive`, `.action`, `details[open]`
- `* { scrollbar-width: thin }`
- inline styles в `templates/chat/combat-outcome.hbs`

Цель: scoped classes под system root и перенос inline styles в SCSS.

## Неактуальные пункты

Удалено из активного техдолга:

- `system.json maximum: "12"`: сейчас `maximum: "13"`.
- NeDB `packs/*.db`: `.db` файлов нет, packs уже LevelDB folders.
- `mergeObject()` global: используется `foundry.utils.mergeObject`.
- `isObjectEmpty()`: используется `foundry.utils.isEmpty`.
- `isNewerVersion()`: используется `foundry.utils.isNewerVersion`.
- `game.system.data.version`: используется `game.system.version`.
- `CONST.CHAT_MESSAGE_TYPES` как единственный API: добавлены fallback-и через `CHAT_MESSAGE_STYLES`.
- `combat-commit.js` legacy `Dialog`: в этом файле `Dialog` больше не используется.

## Рекомендуемый порядок работ

### Этап 1: минимальная стабилизация V13

1. Исправить `ModifiersDialog._updateObject()` recursion.
2. Заменить `Roll._evaluated`.
3. Исправить `convertOldSkill(): data -> system`.
4. Заменить два `Dialog` на `DialogV2` и экранировать interpolated HTML.
5. Решить manifest policy: `verified: "13"` после smoke test, `maximum` оставить `13` или поднять только после V14 проверки.

### Этап 2: sheets migration

1. Перевести `CyberpunkActorSheet` на ApplicationV2.
2. Перевести `CyberpunkItemSheet` на ApplicationV2.
3. Перевести modifiers form на ApplicationV2/DialogV2 flow.
4. Обновить шаблоны под `data-action` и native event handling.
5. Обновить sheet registration.

### Этап 3: cleanup

1. Убрать или изолировать legacy fallback-и (`actor.token`, `game.system.template`).
2. Разделить persisted/derived state.
3. Привести SCSS к scoped/layer-friendly структуре.
4. Проверить V13 live world + compendia.
5. Отдельно проверить V14, только потом менять `maximum`.

## Затронутые файлы

| Файл | Что важно |
|---|---|
| `module/actor/actor-sheet.js` | ApplicationV1, jQuery listeners, legacy Dialog, possible XSS |
| `module/item/item-sheet.js` | ApplicationV1, jQuery listeners, direct system mutation |
| `module/dialog/modifiers.js` | FormApplication, submit recursion, `this.object` |
| `module/item/item.js` | legacy Dialog, possible XSS in combat preview |
| `module/dice.js` | private `Roll._evaluated` |
| `module/migrate.js` | `data:` in migrated skill items, legacy fallback paths |
| `module/lookups.js` | legacy `game.system.template` fallback |
| `module/cyberpunk2020-rilerena.js` | V1 sheet registration |
| `module/actor/actor.js` | direct derived data writes into `system` |
| `scss/`, `css/`, `templates/chat/combat-outcome.hbs` | cascade layers, global selectors, inline styles |
| `system.json` | `verified: "12"`, `maximum: "13"` |

