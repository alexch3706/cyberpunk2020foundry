# Cyberpunk2020VTT → FoundryVTT V13/V14 — Аудит Breaking Changes

> [!CAUTION]
> Текущая система заявляет `"maximum": "12"` в `system.json`. На V13+ она **не запустится** без исправлений. Ниже — полный список того, что сломается.

## Сводка по критичности

| Категория | Критичность | Затронуто файлов | Объём работы |
|-----------|-------------|-----------------|-------------|
| jQuery → DOM API (19 вызовов) | 🔴 Блокер | 3 | Средний |
| Sheet классы (ApplicationV2) | 🔴 Блокер | 3 + шаблоны | Большой |
| `Dialog` (legacy) → `DialogV2` | 🔴 Блокер | 2 | Средний |
| Deprecated APIs в миграции | 🔴 Блокер | 2 | Средний |
| `game.system.template` (удалён) | 🔴 Блокер | 2 (migrate + lookups) | Средний |
| `mergeObject` → `foundry.utils.mergeObject` | 🟠 Высокий | 4 (6 вызовов) | Малый |
| `isObjectEmpty` / `isNewerVersion` | 🟠 Высокий | 2 | Малый |
| `CONST.CHAT_MESSAGE_TYPES` (переименован) | 🟠 Высокий | 2 (dice + combat-commit) | Малый |
| `Roll._evaluated` (приватное) | 🟠 Высокий | 1 (dice.js) | Малый |
| `actor.token` → `actor.prototypeToken` | 🟠 Высокий | 1 (migrate.js) | Малый |
| `convertOldSkill` `data:` → `system:` | 🟡 Средний | 1 (migrate.js) | Малый |
| Формат паков `.db` | 🟡 Средний | 22 файла | Средний |
| CSS Layers | 🟡 Средний | scss/css | Средний |
| `template.json` (deprecated) | 🟢 Низкий | 1 | Не блокирует |
| V14: MeasuredTemplate / Active Effects | 🟢 Низкий | 0 | Не затронуто |

---

## 🔴 Критические (Блокеры)

### 1. jQuery → native DOM API

**Проблема:** В V13 параметр `html` в `activateListeners(html)` — это **plain DOM Element**, не jQuery-объект. Все вызовы `html.find()`, `html.click()`, `html.change()` и т.д. **упадут с ошибкой**.

**Затронутые файлы:**

#### [actor-sheet.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/actor/actor-sheet.js#L133-L253)
~20 вызовов `html.find(...)`:
```javascript
// Строка 170 — и далее множество аналогичных
html.find('.stat-roll').click(ev => { ... });
html.find(".skill-level").click(...).change(...);
html.find(".chip-toggle").click(...);
html.find(".skill-sort > select").change(...);
html.find(".skill-roll").click(...);
html.find(".roll-initiative").click(...);
html.find(".damage").click(...);
html.find(".stun-death-save").click(...);
html.find('.item-roll').click(...);
html.find('.item-edit').click(...);
html.find('.item-delete').click(...);
html.find('.rc-item-delete').bind("contextmenu", ...);  // ← .bind() — тоже jQuery!
html.find('.fire-weapon').click(...);
```

#### [item-sheet.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/item/item-sheet.js#L92-L133)
```javascript
// Строка 94 — jQuery на this.element
const sheetBody = this.element.find(".sheet-body");  // ← this.element тоже может быть DOM
sheetBody.css("height", bodyHeight);

// Строка 110-131
html.find(".item-roll").click(...);
html.find(".accel").click(...);
html.find(".decel").click(...);
html.find('.humanity-cost-roll').click(...);
```

#### [modifiers.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/dialog/modifiers.js#L9)
Наследует `FormApplication` (см. ниже), но не содержит jQuery-listener-ов напрямую.

**Исправление:** Заменить `html.find(selector).click(fn)` на `html.querySelectorAll(selector).forEach(el => el.addEventListener('click', fn))`, или переехать на `ApplicationV2` actions.

---

### 2. Sheet классы: ApplicationV1 → ApplicationV2

**Проблема:** V13 требует миграции с `ActorSheet`/`ItemSheet`/`FormApplication` на `ApplicationV2`-наследников (`HandlebarsApplicationMixin(ActorSheetV2)` и т.д.).

**Затронутые классы:**

| Файл | Текущий базовый класс | Нужен V13 класс |
|------|----------------------|-----------------|
| [actor-sheet.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/actor/actor-sheet.js#L11) | `extends ActorSheet` | `HandlebarsApplicationMixin(ActorSheetV2)` |
| [item-sheet.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/item/item-sheet.js#L9) | `extends ItemSheet` | `HandlebarsApplicationMixin(ItemSheetV2)` |
| [modifiers.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/dialog/modifiers.js#L9) | `extends FormApplication` | `HandlebarsApplicationMixin(ApplicationV2)` |

**Ключевые изменения при миграции:**
- `static get defaultOptions()` → `static DEFAULT_OPTIONS = { ... }`
- `mergeObject(super.defaultOptions, {...})` → объектное наследование
- `activateListeners(html)` → `static DEFAULT_OPTIONS.actions` + `data-action` в шаблонах
- `getData()` → `async _prepareContext(options)` 
- `_updateObject(event, formData)` → `_processSubmitData(event, formData)`
- `render(true)` → `.render({ force: true })`

**Объём:** Это самая большая часть работы. Три класса + все шаблоны `.hbs` нужно адаптировать.

---

### 3. Критические deprecated API

#### [migrate.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/migrate.js)

```javascript
// Строка 29-30 — game.system.data УДАЛЁН в V13
game.system.data.version  // ← ОШИБКА: используй game.system.version

// Строка 38 — isObjectEmpty УДАЛЁН
isObjectEmpty(updateData)  // ← используй foundry.utils.isEmpty(updateData)

// Строка 78, 83, 86 — actor.token → actor.prototypeToken
actor.token.actorLink      // → actor.prototypeToken.actorLink
actor.token.vision         // → actor.prototypeToken.sight.enabled
actorUpdates['token.dimSight'] = 30  // → 'prototypeToken.sight.range'

// Строка 163 — game.system.template УДАЛЁН
game.system.template.Item[item.type].templates  // ← используй game.model

// Строка 172 — game.system.template снова
game.system.template.Item.weapon.rangeDamages

// Строка 196 — data: вместо system:
return {name: ..., type: "skill", data: {...}}  // ← должно быть system: {...}
```

#### [lookups.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/lookups.js)

```javascript
// Строка 26 — game.system.template
game.system.template.Actor  // ← должно быть game.model.Actor

// Строка 154 — game.system.template
game.system.template.Actor.templates.hitLocations.hitLocations
```

#### [dice.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/dice.js)

```javascript
// Строка 119 — приватное свойство
if (!r._evaluated)  // ← используй r.evaluated (публичный геттер)

// Строка 142 — CONST.CHAT_MESSAGE_TYPES.ROLL переименован в V12+
type: CONST.CHAT_MESSAGE_TYPES.ROLL
```

#### [combat-commit.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/combat-commit.js)

```javascript
// Строка 522 — CONST.CHAT_MESSAGE_TYPES.OTHER переименован
CONST.CHAT_MESSAGE_TYPES.OTHER
```

#### [cyberpunk2020.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/cyberpunk2020.js#L54)
```javascript
// Строка 54 — isNewerVersion может быть перемещён
isNewerVersion(...)  // ← используй foundry.utils.isNewerVersion(...)
```

---

## 🟠 Высокие (Ломают функциональность)

### 4. `mergeObject` → `foundry.utils.mergeObject`

Глобальная функция `mergeObject()` удалена в V13. Используется в **четырёх** файлах:

| Файл | Строка |
|------|--------|
| [actor-sheet.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/actor/actor-sheet.js#L15) | `mergeObject(super.defaultOptions, {...})` |
| [item-sheet.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/item/item-sheet.js#L13) | `mergeObject(super.defaultOptions, {...})` |
| [modifiers.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/dialog/modifiers.js#L13) | `mergeObject(super.defaultOptions, {...})` |
| [dice.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/dice.js) | строки 92, 124, 132 — ещё 3 вызова |

**Фикс:** `foundry.utils.mergeObject(...)` или полный переход на ApplicationV2 `DEFAULT_OPTIONS`.

### 5. `Dialog` (legacy) → `DialogV2`

Класс `Dialog` deprecated в V13.

| Файл | Использование |
|------|--------------|
| [actor-sheet.js:148](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/actor/actor-sheet.js#L148) | `new Dialog({...})` для подтверждения удаления |
| [combat-commit.js](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/module/combat/combat-commit.js) | Preview/confirm диалог (новый код!) |

> [!WARNING]
> `combat-commit.js` — это **новый код**, написанный в рамках текущего MVP. Если он использует `Dialog`, его тоже придётся переделывать.

### 6. Формат паков `.db`

22 файла `.db` в старом NeDB формате:

```
packs/armor.db          packs/pistols.db
packs/chipware.db       packs/rifles.db
packs/cyberware.db      packs/smgs.db
... (22 файла)
```

**Факт:** Foundry V11+ автоматически конвертирует NeDB → LevelDB при первом запуске. Однако для разработки и распространения рекомендуется перейти на LevelDB через `foundryvtt-cli`:

```bash
npx @foundryvtt/foundryvtt-cli unpack packs/pistols.db -o packs-json/pistols
# Редактировать JSON
npx @foundryvtt/foundryvtt-cli pack packs-json/pistols -o packs/pistols
```

> [!NOTE]
> Это **не блокер** — Foundry мигрирует `.db` автоматически. Но для system.json V13+ формат `path` может потребовать обновления на директорию вместо файла.

---

## 🟠 Средние (CSS / стили)

### 7. CSS Layers

V13 вводит CSS cascade layers. Текущие SCSS/CSS стили, которые переопределяют классы Foundry (`.sheet`, `.window-app`, `.app`, `.dialog`, `.form-group`), могут потерять приоритет.

**Затронуто:** вся директория [scss/](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/scss/) и [css/](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/css/).

**Фикс:** Обернуть стили в `@layer` блоки или использовать CSS custom properties.

---

## 🟢 Низкие (Не блокируют)

### 8. `template.json`

Файл [template.json](file:///Users/alexanderchuprikov/Documents/Code/Tabletop/Cyberpunk2020VTT/template.json) (881 строка) ещё **поддерживается** в V13 — типы автоматически мержатся в `documentTypes`. Однако код миграции напрямую ссылается на `game.system.template` (строки 163, 172), что сломается.

**Рекомендация:** `template.json` можно оставить, но код, читающий `game.system.template`, нужно обновить на `game.model`.

### 9. V14-специфичные изменения

| Изменение V14 | Затрагивает проект? |
|---------------|-------------------|
| Удаление `MeasuredTemplate` | ❌ Нет — проект не использует шаблоны измерений |
| Active Effects V2 | ❌ Нет — проект не использует Active Effects |
| Scene Levels | ❌ Нет — проект не создаёт сцены |
| Document write-batching | ⚠️ Возможно — `combat-commit.js` делает последовательные `actor.update()` |

> [!NOTE]
> V14 для этого проекта **гораздо менее проблематичен**, чем V13. Основной удар приходится на V12→V13.

---

## Дополнительные находки в коде

### Прямая мутация `system` (уже известная проблема)

```javascript
// item-sheet.js:130 — прямая мутация без update()!
cyber.system.humanityLoss = loss;
cyber.sheet.render(true);
```

Это **уже** было известной проблемой проекта (Story 6.5 в эпиках). В V13+ это может работать ещё хуже.

### `this.object` — V1 FormApplication property

```javascript
// modifiers.js:82, 85 — this.object удалён в ApplicationV2
this.object = updateData;
let result = this.object;

// item-sheet.js:118 — this.object вместо this.document
const cyber = this.object;
```

### `Roll._evaluated` — приватное свойство

```javascript
// dice.js:119
if (!r._evaluated)  // → используй r.evaluated
```

### `Actors.registerSheet` / `Items.registerSheet` — устаревший синтаксис

```javascript
// cyberpunk2020.js:28-31 — V1 sheet registration
Actors.unregisterSheet("core", ActorSheet);
Actors.registerSheet("cyberpunk2020", CyberpunkActorSheet, { makeDefault: true });
// V13+: DocumentSheetConfig.registerSheet(Actor, ...) или аналог
```

### ✅ Что НЕ затронуто (хорошие новости)

- Нет глобального `$(` или `$.` jQuery — зависимость только через параметр `html`
- Нет `.data.data` — уже мигрировали на `.system`
- Нет `entity.data` — используются Document API
- Нет `MeasuredTemplate` — не используются
- Нет `ActiveEffect` — не используются
- Нет `CONFIG.Actor.systemDataModels` — не объявлены (но нужно будет добавить для V13)

---

### Находки детального Code Review (Actor & Item Classes)

В ходе глубокого статического анализа файлов `actor.js`, `actor-sheet.js`, `skill-sort.js`, `item.js` и `item-sheet.js` были выявлены следующие критические и важные проблемы:

#### 🔴 Критические баги и уязвимости

1. **`oldSearch` ReferenceError в `actor-sheet.js` (L76)**:
   Использование неопределенной переменной `oldSearch` вместо `sheetData.system.transient.oldSearch` полностью ломает оптимизацию поиска навыков при вводе в рантайме.
2. **XSS-уязвимость в подтверждении удаления в `actor-sheet.js` (L150)**:
   Прямая интерполяция имени предмета (`item.name`) в HTML-разметку диалога без экранирования позволяет исполнять произвольный JS-код через специально названные предметы.
3. **Несохранение стоимости Человечности (Humanity Loss) в `item-sheet.js` (L116–132)**:
   При броске стоимости человечности для киберпрограммы значение присваивается напрямую (`cyber.system.humanityLoss = loss`) без вызова `update()`. При первой же перерисовке или перезагрузке страницы эти данные теряются.
4. **Некорректный жизненный цикл `_onCreate` в `actor.js` (L14–33)**:
   - Не вызывается обязательный `super._onCreate()`, что ломает Foundry-хуки создания документов.
   - Отсутствует проверка `game.user.id !== userId`, из-за чего инициализация навыков у нового актера запускается одновременно всеми подключенными клиентами (риск рассинхронизации данных).
   - Вызовы `this.update` не ожидаются (`await`).
5. **Неверный биндинг `roll()` в `item-sheet.js` (L110)**:
   Контекст броска привязывается к листу предмета (`this.item.roll.bind(this)`) вместо самого предмета. Это приводит к падениям при попытке броска оружия с его листа.
6. **Отсутствие проверки владельца в `_prepareArmorData` (`item.js`: L43, L50)**:
   Обращение к `this.actor.id` вызывает падение системы при обработке неэкипированных/непривязанных предметов (например, лежащих в компендиумах или сайдбаре).
7. **Опечатка в очистке зон брони (`item.js`: L66)**:
   Код делает `delete system.coverage.armorArea` вместо `delete system.coverage[armorArea]`, из-за чего неиспользуемые зоны никогда не удаляются.
8. **Неатомарное списание патронов при Full Auto (`item.js`: L411)**:
   Вызовы `this.update()` выполняются в цикле, но считывают исходное (устаревшее) значение `system.shotsLeft` из одного снимка данных, занижая реальный расход боеприпасов при нескольких целях.

#### 🟠 Серьезные проблемы (Major)

1. **Использование `prepareData` вместо `prepareDerivedData` в `actor.js`**:
   Расчет производных параметров (armor, cyberware, woundMod) происходит до того, как вложенные документы (предметы) завершат свою подготовку, что приводит к некорректным расчетным значениям.
2. **Прямое изменение (мутация) `this.system`**:
   В `_prepareCharacterData` свойства вроде `stoppingPower`, `run`, `leap`, `carry` пишутся напрямую в `system`. Это устаревший подход, несовместимый с современными `DataModel` схемами.
3. **Захардкоженные строки для навыков**:
   Фильтрация по `skill.name.startsWith("Martial")` и проверка `Awareness/Notice` прописаны строками в JS-коде, что сломает логику при включении локализации.
4. **Устаревший jQuery-event binding в листах**:
   Использование `html.find().click(...)` вместо делегирования событий на уровне корня листа создает избыточные слушатели для каждого элемента.
5. **Циклическая зависимость**:
   `skill-sort.js` импортирует `actor.js`, а `actor.js` импортирует `skill-sort.js`, создавая риск получения `undefined` при инициализации модулей.
6. **Несогласованность вызовов `Roll` API**:
   Некоторые методы создают неоцененные (`unevaluated`) броски, которые отображаются в чате формулой вместо результата.


---

### Находки детального Code Review (Combat System & Modifiers)

#### 🔴 Критические баги

1. **Бесконечная рекурсия в диалоге модификаторов (`modifiers.js`: L83)**:
   В классе `ModifiersDialog`, метод `_updateObject` ошибочно вызывает `this.submit()`. Поскольку `submit()` сам по себе вызывает `_updateObject`, это приводит к бесконечному циклу отправки формы и переполнению стека вызовов (infinite recursion). Нужно убрать вызов `submit()` и вызывать `onConfirm` напрямую с переданными `formData`.

#### 🟠 Серьезные проблемы (Major) / Расхождения с правилами

2. **Порядок расчета бронебойного (AP) урона и BTM в `attack-resolver.js` (L552-L556, L921-L926)**:
   При стрельбе бронебойными патронами (AP) урон, прошедший сквозь броню, делится пополам (`penetratingDamage = Math.floor(penetratingDamage / 2)`), а затем передается в `resolveBodyTypeDamage`, где из него вычитается BTM (модификатор типа тела). 
   Необходимо перепроверить соответствие этого порядка правилам Cyberpunk 2020: деление урона пополам должно происходить *после* применения BTM или *до* него. Если BTM применяется после деления, это приводит к чрезмерному снижению урона (например, 10 урона через броню → делится до 5 → BTM -4 → наносится всего 1 урон вместо (10 - 4)/2 = 3).

---

### Находки детального Code Review (Core & Utility Modules)

#### 🔴 Критические баги

1. **`migrate.js` (L151) — дублирование предметов актера при миграции навыков**:
   `currentItems.concat(currentItems, skillsToAdd)` конкатенирует массив с самим собой — каждый существующий предмет дублируется. Должно быть `currentItems.concat(skillsToAdd)`.
2. **`migrate.js` (L10) — `migrationSuccess` как модульная глобальная переменная нарушает идемпотентность**:
   ES-модули — синглтоны. Если `migrateWorld()` не выполнилась и вызывается повторно, переменная уже `false`, и успешный повтор всё равно не сохранит версию. Нужно переместить переменную внутрь функции.
3. **`dice.js` (L142) — `CONST.CHAT_MESSAGE_TYPES.ROLL` удалён в Foundry v12**:
   Уже задокументировано в разделе 🔴 Критические, подтверждено повторно.

#### 🟠 Серьёзные проблемы (Major)

4. **`migrate.js` (L29-30) — `game.system.data.version` не существует в v10+**:
   API v9. Из-за этого версия миграции никогда не сохраняется и миграция запускается при каждой загрузке мира. Исправление: `game.system.version`.
5. **`migrate.js` (L38) — `isObjectEmpty()` удалён в v12**:
   Исправление: `foundry.utils.isEmpty()`.
6. **`migrate.js` (L185-191) — `async` в `forEach` поглощает ошибки миграции компендиумов**:
   `Array.forEach` не ожидает async-коллбэков. Нужно переходить на `for...of` с `await`.
7. **`migrate.js` (L196) — `data:` вместо `system:` в `convertOldSkill`**:
   Данные навыка записываются в устаревший ключ `data`, а не `system`. Разрушает данные навыков при миграции.
8. **`migrate.js` (L79-87) — `token.*` вместо `prototypeToken.*` в миграции токенов**:
   В v10+ прототип токена — `prototypeToken`, не `token`. Пути обновления тихо проваливаются.
9. **`cyberpunk2020.js` (L54) — `isNewerVersion()` удалён в v12**:
   Исправление: `foundry.utils.isNewerVersion()`.
10. **`handlebars-helpers.js` (L18-21) — `CPLocalParam` передаёт весь `options` объект в `i18n.format()`**:
    Должен передавать `options.hash`. Вызывает сбои при использовании хелпера `CPLocalParam` с параметрами.
11. **`dice.js` (L92, 124, 132) — `mergeObject()` удалён в v12**:
    Уже задокументировано, подтверждено повторно.
12. **`dice.js` (L119) — обращение к приватному свойству `r._evaluated`**:
    Использование внутреннего API Roll класса. Публичная альтернатива: `r.total === null`.

#### 🟡 Незначительные проблемы (Minor)

13. **`lookups.js` (L156) — импорт в середине файла**: Импорт ES-модулей должен быть вверху файла.
14. **`utils.js` (L64) — `deepLookup` без null-безопасности**: При отсутствующем сегменте пути выбрасывает `TypeError`. Нужно `current?.[segment]`.
15. **`utils.js` (L95-98) — `getDefaultSkills()` без проверки на null**: Падает если компендиум `cyberpunk2020.default-skills` не найден.
16. **`dev-tools.js` (L5) — отсутствует расширение `.js` в импорте**: Foundry ESModule загрузчик требует явных расширений.
17. **`cyberpunk2020.js` (L39, L56) — `preloadHandlebarsTemplates()` и `migrateWorld()` не ожидаются через `await`**: Оба вызова — fire-and-forget. Добавить `await` и сделать хуки `async`.
18. **`handlebars-helpers.js` (L97) — `hasElements` без проверки на null**: `array.length > 0` упадёт если `array` — `null` или `undefined`.
19. **`dice.js` (L173) — мёртвый код `d10Roll()`**: Функция не экспортирована и нигде не вызывается. Удалить или экспортировать.
20. **`dice.js` (L147) — хардкод `"sounds/dice.wav"`**: Нарушает пользовательские/модульные переопределения звука. Использовать `CONFIG.sounds.dice`.

---

### Находки детального Code Review (Шаблоны, Локализация & SCSS)

#### 🔴 Критические баги

1. **`vehicle/summary.hbs` — полностью пустой файл**:
   Шаблон саммари транспортного средства не содержит ничего. Предметы типа `vehicle` не отображают заголовок в листе предмета.
2. **`cyberware/settings.hbs` (L9) — паразитный HTML-атрибут `S` на `<input>`**:
   `<input ... S type="text">` — невалидный HTML. Паразитный символ `S` на элементе.
3. **`combat-outcome.hbs` (L104) — огромный `style` атрибут с вложенными Handlebars-условиями**:
   Четыре `{{#if}}`-блока с хардкодными hex-цветами в `style` атрибуте статус-баннера. Цвета не попадают под CSS-тему, нечитаемо, нарушает WCAG 1.4.1 (цвет — единственный индикатор статуса). Перенести в SCSS через классы `.status-preview`, `.status-committed` и т.д.
4. **`actor-sheet.hbs` и шаблоны настроек предметов — лейблы как сырые английские строки**:
   `label="Role"`, `label="Damage"`, `label="AP"` и т.п. передаются в field-партиалы как литеральные строки и лишь по совпадению работают с `CPLocal` (совпадение суффикса ключа). Хрупкая конструкция, сломается при изменении имён ключей локализации.

#### 🟠 Серьёзные проблемы (Major)

5. **`woundtracker.hbs` (L5) — названия состояний ранений не локализованы**:
   `{{stateName}}` выводит "Uninjured", "Light", "Serious" и т.д. в сыром виде. Все три языковых файла содержат нужные ключи — инфраструктура есть, но не используется.
6. **Смешанное использование `{{localize}}` и `{{CPLocal}}`**:
   Вкладки в `actor-sheet.hbs` используют `{{localize 'CYBERPUNK.TabSkills'}}`, всё остальное — `{{CPLocal "Key"}}`. Нужно выбрать один подход и применить везде.
7. **`actor-sheet.hbs` (L51) — вкладка Cyberware имеет CSS-класс `gear`**:
   `class="tab gear flexcol" data-tab="cyber"` — к вкладке кибервера применяются стили вкладки снаряжения.
8. **`vehicle/settings.hbs` (L51, 65, 86, 96) — атрибуты `for` указывают на неправильные `id`**:
   Несколько `<label for="system.speed.value">` для полей Acceleration, Safe Speed, Fuel. Нарушает accessibility.
9. **`default-roll.hbs` (L26) — тройные фигурные скобки `{{{this.result}}}` — потенциальный XSS**:
   Тройные мусташи выводят неэкранированный HTML. Если `result` содержит пользовательские данные — вектор XSS.
10. **Локализация EN — в именах ключей мартиальных искусств пробелы и двоеточия**:
    `"CYBERPUNK.SkillMartial Arts: Aikido"` — JSON-ключ с пробелами и двоеточием. ES и IT используют чистые `CYBERPUNK.SkillAikido`. Кросс-языковое несоответствие.
11. **Испанская локализация — пропущенные и непереведённые ключи**:
    Отсутствуют `CYBERPUNK.Target`, `CYBERPUNK.TargetsCount`. Оставлены на английском: `CYBERPUNK.RoF`, `CYBERPUNK.KeyTechniqueWarning`, `CYBERPUNK.TurnFace`, `CYBERPUNK.Ricochet`.
12. **Итальянская локализация — 57 дополнительных ключей Lifepath, отсутствующих в EN/ES**:
    IT расширена разделом `CYBERPUNK.Lifepath*` (37 ключей) без обратного портирования в EN/ES. IT также не имеет ключей SETTINGS: `CombatDamageCommitMode*`, `SuppressiveFireManualWarning`.
13. **`_weaponModifiers.scss` — никогда не импортируется в `cyberpunk2020.scss`**:
    Диалог модификаторов оружия полностью лишён заданных для него стилей.

#### 🟡 Незначительные проблемы (Minor)

14. **Поле поиска навыков без `aria-label`** (`skills.hbs`)
15. **Кнопки-иконки (trash, edit) без `aria-label`** (`skill.hbs`, `cyberware.hbs`)
16. **Приватные API в шаблонах**: `roll._formula` в `default-roll.hbs:17`, `attackRoll._total` в `multi-hit.hbs:23` — использовать публичные `formula` и `total`
17. **Несоответствие параметров**: `noTranslateChoices` передаётся в `modifiers.hbs`, но проверяется `noTranslateOptions` в `select.hbs` — флаг тихо игнорируется
18. **`statsrow.hbs` (L45) — неэкранированное значение атрибута `title`**: `title={{CPLocal "Humanity"}}` — атрибут не обёрнут в кавычки, сломается при наличии пробелов в переводе
19. **`en.json` (L169)** — `"PlayInstrument"` без пробела, должно быть `"Play Instrument"`
20. **Многочисленные inline-стили в `combat-outcome.hbs`**: 8+ inline `style` атрибутов с повторяющимися magic hex-цветами — всё нужно перенести в SCSS
21. **Глобальные CSS-селекторы без `.cyberpunk`-скоупа**: `.inactive`, `.action`, `* { scrollbar-width: thin }` и `details[open]` анимация применяются ко всему интерфейсу Foundry
22. **Опечатки в переводах ES**: ~10 опечаток: `"Técnica médita"` → `médica`, `"Maneejo"` → `Manejo`, `"Banzina"` (IT) → `Benzina` и др.
23. **`{{editor}}` хелпер устарел в Foundry v11+**: Использовать `<prose-mirror>` или `foundry-editor` веб-компонент

---

## План миграции (порядок работ)


### Этап 1: Минимальная совместимость с V13 (без ApplicationV2)

1. Обновить `system.json`: `"minimum": "12", "verified": "13", "maximum": "14"`
2. Заменить `mergeObject()` → `foundry.utils.mergeObject()`
3. Заменить `isObjectEmpty()` → `foundry.utils.isEmpty()`
4. Заменить `isNewerVersion()` → `foundry.utils.isNewerVersion()`
5. Заменить `game.system.data.version` → `game.system.version`
6. Заменить `game.system.template` → `game.model` или `game.documentTypes`
7. Обернуть `html` в jQuery в `activateListeners`: `html = $(html)` — **временный хак**

> [!IMPORTANT]
> Шаг 7 — это костыль. jQuery ещё доступен в V13, но `html` передаётся как DOM element. Обёртка `$(html)` позволит `html.find()` работать без полной переработки. Это даёт **совместимость без полного рефакторинга**.

### Этап 2: Полный переход на ApplicationV2

8. Мигрировать `CyberpunkActorSheet` на `HandlebarsApplicationMixin(ActorSheetV2)`
9. Мигрировать `CyberpunkItemSheet` на `HandlebarsApplicationMixin(ItemSheetV2)`
10. Мигрировать `ModifiersDialog` на `ApplicationV2`
11. Мигрировать `Dialog` → `DialogV2`
12. Обновить все `.hbs` шаблоны для `data-action` паттерна
13. Обновить CSS/SCSS для CSS Layers

### Этап 3: Паки и финализация

14. Конвертировать `.db` паки через `foundryvtt-cli` (если нужно)
15. Протестировать в живом Foundry V13/V14
16. Обновить `system.json` manifest

---

## Оценка трудозатрат

| Этап | Оценка | Описание |
|------|--------|----------|
| Этап 1 (минимальный) | **3-5 часов** | Замена ~20 deprecated API вызовов + jQuery-обёртка |
| Этап 2 (ApplicationV2) | **2-3 дня** | Полный рефакторинг 3 sheet-классов + шаблоны |
| Этап 3 (паки + тесты) | **0.5-1 день** | Конвертация + ручное тестирование в Foundry |
| **Итого** | **3-4 дня** | При условии знакомства с ApplicationV2 |

> [!TIP]
> **Рекомендация:** Можно сделать **Этап 1** прямо сейчас как промежуточный шаг — это даст рабочую систему на V13 без полного рефакторинга. ApplicationV2 миграцию можно отложить на отдельный эпик.

---

## Полная сводка затронутых файлов

| Файл | 🔴 Крит. | 🟠 Выс. | 🟡 Сред. |
|------|---------|---------|----------|
| `module/actor/actor-sheet.js` | 17 (jQuery + Sheet + Dialog) | 1 (mergeObject) | — |
| `module/item/item-sheet.js` | 7 (jQuery + Sheet + this.object) | 1 (mergeObject) | — |
| `module/dialog/modifiers.js` | 5 (FormApp + submit + object) | 1 (mergeObject) | — |
| `module/migrate.js` | 4 (system.data + template) | 1 (isObjectEmpty) | 2 (token + data:) |
| `module/cyberpunk2020.js` | — | 1 (isNewerVersion) | 1 (registerSheet) |
| `module/dice.js` | — | 5 (mergeObject×3 + _evaluated + CHAT_TYPE) | — |
| `module/lookups.js` | 2 (game.system.template) | — | — |
| `module/combat/combat-commit.js` | — | 1 (CHAT_TYPE) | — |
| `template.json` | — | — | 1 (deprecated format) |
| `system.json` | 1 (max: "12") | — | — |
| `scss/` | — | — | 3+ (CSS layers) |
| `packs/*.db` | — | — | 22 (NeDB format) |
| **ИТОГО** | **~36** | **~12** | **~29** |
