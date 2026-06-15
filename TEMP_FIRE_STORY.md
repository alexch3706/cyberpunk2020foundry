Что в предложении верно

Если цель A стоит на 5 м, а цель B на 50 м, то применять к ним один Range из ModifiersDialog действительно неправильно.

В CP2020 range bands завязаны на дистанцию до конкретной цели: Close = ¼ listed range, Medium = ½, Long = listed range, Extreme = ×2. А full-auto модификатор зависит от range: на Close даётся бонус за плотность огня, на остальных дальностях — штраф за разброс/отдачу. Это подтверждается и в сводке модификаторов: Full Auto на Close даёт +1 for every 10 rnds, Full Auto на остальных — -1 for every 10 rnds.

То есть логика:

for each target:
  distance = measuredDistance(attacker, target)
  rangeBand = getRangeBand(weaponRange, distance)
  hitNumber = getHitNumber(rangeBand)
  fullAutoModifier = getFullAutoModifier(rangeBand, bulletsAllocatedToThisTarget)
  resolveAttack(target, hitNumber, fullAutoModifier)

— это правильное направление.

Главный нюанс: пули распределяются не “по дистанции”, а до бросков

Я бы не делал так, чтобы каждая цель сама решала “сколько в неё летит пуль” на основе своей дистанции. Сначала должен быть общий шаг:

Определили список целей.
Определили общий расход пуль / ROF.
Разделили пули между целями.
Потом для каждой цели отдельно посчитали distance, range bracket, DC и full-auto modifier.

То есть:

const bulletsPerTarget = Math.floor(totalBulletsFired / targetCount);

Или, если включён expanded rule:

const bulletsPerTarget = Math.floor(
  totalBulletsFired / (targetCount + sweepDistanceMeters)
);

А уже потом:

for (const target of targets) {
  const rangeBand = getRangeBandForTarget(attacker, target, weapon);
  const hitNumber = getHitNumber(rangeBand);

  const fullAutoMod = getFullAutoModifier(
    rangeBand,
    bulletsPerTarget
  );

  const attackResult = resolveAttack({
    target,
    hitNumber,
    fullAutoMod,
    bulletCap: bulletsPerTarget
  });
}
В твоём примере

Винтовка, listed range допустим 50 м.

Цель A на 5 м:

5 <= 12.5 // Close
DC = 15
Full Auto modifier = +1 per 10 bullets allocated

Цель B на 50 м:

50 <= 50 // Long
DC = 25
Full Auto modifier = -1 per 10 bullets allocated

Да, это честнее, чем брать один общий Range = Long или Range = Close для обеих.

Что я бы изменил в UI

В ModifiersDialog при нескольких целях лучше не ставить “самую дальнюю дистанцию” как будто это реальный выбранный Range. Это может запутать.

Лучше так:

Range: Auto (per target)

И рядом/ниже мини-таблица:

Target            Distance    Range     Hit Number
Ganger A          5m          Close     15
Ganger B          50m         Long      25

Если хочется оставить override, то лучше отдельной опцией:

[ ] Override range manually for all targets

Но дефолт должен быть Auto per target.

Важный edge case: Full Auto modifier считать от allocated bullets, не от hits

Модификатор +1/-1 per 10 rounds должен считаться от количества пуль, которые были выпущены/выделены в цель, а не от фактических попаданий.

Например:

bulletsPerTarget = 12
range = Close
fullAutoMod = +1

Даже если потом попала только 1 пуля, модификатор всё равно был от плотности огня в 12 пуль.

Ещё один edge case: Point Blank

Для Point Blank я бы явно прописал отдельное поведение. В книге Point Blank — это “ствол очень близко или в физическом контакте”, Hit Number 10 и maximum damage. Но full-auto модификатор в таблицах обычно формулируется как Close +1, а не “Point Blank + Close”. Поэтому в VTT лучше не оставлять это неявным.

Я бы сделал так:

if (rangeBand === "pointBlank") {
  hitNumber = 10;
  damageMode = "maximum";
  fullAutoMod = 0; // или table setting
}

И добавить настройку, если хочешь дать мастеру свободу:

pointBlankFullAutoModifierMode:
  | "none"
  | "treatAsClose"
  | "treatAsOtherRange";

Мой предпочтительный вариант: none, потому что Point Blank уже очень сильный из-за DC 10 и maximum damage.

Итоговый вердикт

Агент предлагает правильное архитектурное исправление:

Multi-target Full Auto должен использовать individual distance/range per target.

Я бы только сформулировал задачу точнее:

При multi-target Full Auto Range в ModifiersDialog переводится в режим Auto (Per Target).
Перед резолвом система измеряет дистанцию от атакующего до каждой цели.
Распределение пуль считается один раз для всей атаки.
Затем для каждой цели отдельно вычисляются Range Bracket, Hit Number и Full Auto modifier.
Attack roll выполняется отдельно по каждой цели.
Количество попаданий по каждой цели ограничено bulletCapPerTarget.