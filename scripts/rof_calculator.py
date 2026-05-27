#!/usr/bin/env python3
"""Quick Cyberpunk 2020 ROF/fire-mode calculator.

Standalone helper for rough table calculations. Press Enter at any prompt to
accept the shown default.
"""

from __future__ import annotations

import math
import random
import re
from dataclasses import dataclass


RANGE_DCS = {
    "point blank": 10,
    "close": 15,
    "medium": 20,
    "long": 25,
    "extreme": 30,
    "out of range": math.inf,
}

FIRE_MODES = {
    "1": "semi",
    "2": "burst",
    "3": "fullauto",
    "4": "suppressive",
    "semi": "semi",
    "semiauto": "semi",
    "single": "semi",
    "burst": "burst",
    "three": "burst",
    "3rb": "burst",
    "full": "fullauto",
    "fullauto": "fullauto",
    "auto": "fullauto",
    "suppressive": "suppressive",
    "suppress": "suppressive",
}

BODY_LOCATIONS = {
    "head": "head",
    "torso": "torso",
    "body": "torso",
    "rarm": "right_arm",
    "rightarm": "right_arm",
    "right arm": "right_arm",
    "larm": "left_arm",
    "leftarm": "left_arm",
    "left arm": "left_arm",
    "rleg": "right_leg",
    "rightleg": "right_leg",
    "right leg": "right_leg",
    "lleg": "left_leg",
    "leftleg": "left_leg",
    "left leg": "left_leg",
}

LOCATION_LABELS = {
    "head": "Head",
    "torso": "Torso",
    "right_arm": "Right arm",
    "left_arm": "Left arm",
    "right_leg": "Right leg",
    "left_leg": "Left leg",
}


@dataclass
class AttackInput:
    fire_mode: str
    weapon_name: str
    weapon_accuracy: int
    weapon_rof: int
    shots_left: int
    weapon_range_m: int
    damage: str
    shooter_ref: int
    shooter_skill: int
    distance_m: float
    target_count: int
    target_sp: int
    target_btm: int
    armor_piercing: bool
    aimed_location: str | None
    target_move_mod: int
    aim_rounds: int
    smartgun_mod: int
    extra_mod: int
    fire_zone_width_m: float
    attack_roll_mode: str
    manual_d10_total: int | None
    manual_d10_rolls: list[int] | None


def ask_str(label: str, default: str) -> str:
    raw = input(f"{label} [{default}]: ").strip()
    return raw if raw else default


def ask_int(label: str, default: int, minimum: int | None = None, maximum: int | None = None) -> int:
    while True:
        raw = input(f"{label} [{default}]: ").strip()
        if not raw:
            value = default
        else:
            try:
                value = int(raw)
            except ValueError:
                print("  Enter an integer.")
                continue
        if minimum is not None and value < minimum:
            print(f"  Minimum is {minimum}.")
            continue
        if maximum is not None and value > maximum:
            print(f"  Maximum is {maximum}.")
            continue
        return value


def ask_float(label: str, default: float, minimum: float | None = None) -> float:
    while True:
        raw = input(f"{label} [{default:g}]: ").strip()
        if not raw:
            value = default
        else:
            try:
                value = float(raw)
            except ValueError:
                print("  Enter a number.")
                continue
        if minimum is not None and value < minimum:
            print(f"  Minimum is {minimum:g}.")
            continue
        return value


def ask_bool(label: str, default: bool) -> bool:
    suffix = "Y/n" if default else "y/N"
    while True:
        raw = input(f"{label} [{suffix}]: ").strip().lower()
        if not raw:
            return default
        if raw in {"y", "yes", "д", "да"}:
            return True
        if raw in {"n", "no", "н", "нет"}:
            return False
        print("  Enter yes/no.")


def ask_attack_roll(default_auto: bool = True) -> tuple[str, int | None, list[int] | None]:
    auto_roll = ask_bool("Auto-roll attack d10", default_auto)
    if auto_roll:
        return "auto", None, None

    while True:
        raw = input("Manual d10 result, e.g. 7 or 10,6 [7]: ").strip()
        if not raw:
            return "manual", 7, [7]

        parts = [part.strip() for part in raw.replace("+", ",").split(",")]
        try:
            rolls = [int(part) for part in parts if part]
        except ValueError:
            print("  Enter an integer or comma-separated exploding rolls, e.g. 10,6.")
            continue

        if not rolls:
            print("  Enter at least one value.")
            continue
        if any(roll < 1 or roll > 10 for roll in rolls):
            print("  Each d10 value must be from 1 to 10.")
            continue
        if len(rolls) > 1 and any(roll != 10 for roll in rolls[:-1]):
            print("  Only 10 explodes. Use format like 10,6 or 10,10,4.")
            continue

        return "manual", sum(rolls), rolls


def ask_aimed_location() -> str | None:
    options = "none, head, torso, right arm, left arm, right leg, left leg"
    while True:
        raw = input("Aimed location [{none}]: ".format(none="none")).strip().lower().replace("-", " ")
        if not raw or raw in {"none", "no", "random"}:
            return None
        compact = raw.replace("_", " ")
        if compact in BODY_LOCATIONS:
            return BODY_LOCATIONS[compact]
        print(f"  Choose one of: {options}.")


def ask_fire_mode(default: str = "fullauto") -> str:
    print("Fire mode: 1) SemiAuto  2) ThreeRoundBurst  3) FullAuto  4) Suppressive")
    while True:
        raw = input(f"Fire mode [{default}]: ").strip().lower().replace("-", "").replace("_", "")
        if not raw:
            return default
        if raw in FIRE_MODES:
            return FIRE_MODES[raw]
        print("  Choose 1, 2, 3, 4, semi, burst, fullauto, or suppressive.")


def range_band(distance_m: float, weapon_range_m: int) -> str:
    if distance_m <= 1:
        return "point blank"
    if distance_m <= weapon_range_m / 4:
        return "close"
    if distance_m <= weapon_range_m / 2:
        return "medium"
    if distance_m <= weapon_range_m:
        return "long"
    if distance_m <= weapon_range_m * 2:
        return "extreme"
    return "out of range"


def parse_damage_average(damage: str) -> float | None:
    """Parse simple dice like 4d6, 2d6+1, 5d6-2."""
    match = re.fullmatch(r"\s*(\d+)d(\d+)\s*([+-]\s*\d+)?\s*", damage.lower())
    if not match:
        return None
    count = int(match.group(1))
    sides = int(match.group(2))
    bonus = int(match.group(3).replace(" ", "")) if match.group(3) else 0
    return count * (sides + 1) / 2 + bonus


def parse_damage_max(damage: str) -> int | None:
    """Parse max value for simple dice like 4d6, 2d6+1, 5d6-2."""
    match = re.fullmatch(r"\s*(\d+)d(\d+)\s*([+-]\s*\d+)?\s*", damage.lower())
    if not match:
        return None
    count = int(match.group(1))
    sides = int(match.group(2))
    bonus = int(match.group(3).replace(" ", "")) if match.group(3) else 0
    return count * sides + bonus


def roll_damage(damage: str) -> int | None:
    match = re.fullmatch(r"\s*(\d+)d(\d+)\s*([+-]\s*\d+)?\s*", damage.lower())
    if not match:
        return None
    count = int(match.group(1))
    sides = int(match.group(2))
    bonus = int(match.group(3).replace(" ", "")) if match.group(3) else 0
    return sum(random.randint(1, sides) for _ in range(count)) + bonus


def roll_cp2020_d10() -> tuple[int, list[int]]:
    """Roll 1d10 with exploding 10s. Fumble tables are not handled here."""
    rolls = [random.randint(1, 10)]
    while rolls[-1] == 10:
        rolls.append(random.randint(1, 10))
    return sum(rolls), rolls


def roll_hit_location() -> tuple[str, int]:
    roll = random.randint(1, 10)
    if roll == 1:
        return "head", roll
    if roll <= 4:
        return "torso", roll
    if roll == 5:
        return "right_arm", roll
    if roll == 6:
        return "left_arm", roll
    if roll <= 8:
        return "right_leg", roll
    return "left_leg", roll


def success_chance(base_total: int, dc: int) -> float:
    if math.isinf(dc):
        return 0.0

    chance = 0.0
    needed = dc - base_total

    # A CP2020 d10 explodes on 10: each terminal result is 10*k + 1..9.
    for explosions in range(20):
        prefix = 10 * explosions
        prefix_probability = 0.1 ** explosions
        for terminal_die in range(1, 10):
            probability = prefix_probability * 0.1
            if prefix + terminal_die >= needed:
                chance += probability

    return min(chance, 1.0)


def fire_plan(data: AttackInput, band: str) -> dict[str, int | float]:
    available = max(0, min(data.weapon_rof, data.shots_left))
    target_count = max(1, data.target_count)

    if data.fire_mode == "semi":
        return {"rounds_per_target": 1 if available else 0, "total_rounds": 1 if available else 0}

    if data.fire_mode == "burst":
        fired = min(3, available)
        return {"rounds_per_target": fired, "total_rounds": fired}

    if data.fire_mode == "fullauto":
        rounds_per_target = math.floor(available / target_count)
        return {
            "rounds_per_target": rounds_per_target,
            "total_rounds": rounds_per_target * target_count,
        }

    if data.fire_mode == "suppressive":
        width = max(2.0, data.fire_zone_width_m)
        return {
            "total_rounds": available,
            "fire_zone_width_m": width,
            "save_number": math.floor(available / width),
        }

    raise ValueError(f"Unsupported fire mode: {data.fire_mode}")


def mode_modifier(fire_mode: str, band: str, rounds_per_target: int) -> int:
    if fire_mode == "burst" and band in {"close", "medium"}:
        return 3
    if fire_mode == "fullauto":
        chunks = math.floor(rounds_per_target / 10)
        if band == "close":
            return chunks
        if band in {"medium", "long", "extreme"}:
            return -chunks
    return 0


def collect_input() -> AttackInput:
    print("\nCyberpunk 2020 ROF calculator")
    print("Press Enter to accept defaults.\n")

    fire_mode = ask_fire_mode()

    print("\nWeapon")
    weapon_name = ask_str("Weapon name", "Militech Ronin")
    weapon_accuracy = ask_int("Weapon Accuracy / WA", 1)
    weapon_rof = ask_int("ROF", 30, minimum=0)
    shots_left = ask_int("Shots left", 30, minimum=0)
    weapon_range_m = ask_int("Weapon range, meters", 400, minimum=1)
    damage = ask_str("Damage dice", "5d6")

    print("\nShooter")
    shooter_ref = ask_int("REF", 8)
    shooter_skill = ask_int("Shooting skill", 7)
    aim_rounds = ask_int("Aim rounds, max 3", 0, minimum=0, maximum=3)
    smartgun_mod = ask_int("Smartgun/sight modifier", 0)
    extra_mod = ask_int("Other attack modifier", 0)

    print("\nTarget / context")
    distance_m = ask_float("Distance to target, meters", 30, minimum=0)
    target_count = ask_int("Target count", 1, minimum=1)
    target_sp = ask_int("Target armor SP for rough damage", 20, minimum=0)
    target_btm = ask_int("Target BTM, e.g. -2", -2)
    armor_piercing = ask_bool("Armor piercing ammo", False)
    aimed_location = ask_aimed_location()
    target_move_mod = ask_int("Target movement/size/cover modifier", 0)
    fire_zone_width_m = ask_float("Suppressive fire-zone width, meters", 2, minimum=2)
    attack_roll_mode, manual_d10_total, manual_d10_rolls = ask_attack_roll(True)

    return AttackInput(
        fire_mode=fire_mode,
        weapon_name=weapon_name,
        weapon_accuracy=weapon_accuracy,
        weapon_rof=weapon_rof,
        shots_left=shots_left,
        weapon_range_m=weapon_range_m,
        damage=damage,
        shooter_ref=shooter_ref,
        shooter_skill=shooter_skill,
        distance_m=distance_m,
        target_count=target_count,
        target_sp=target_sp,
        target_btm=target_btm,
        armor_piercing=armor_piercing,
        aimed_location=aimed_location,
        target_move_mod=target_move_mod,
        aim_rounds=aim_rounds,
        smartgun_mod=smartgun_mod,
        extra_mod=extra_mod,
        fire_zone_width_m=fire_zone_width_m,
        attack_roll_mode=attack_roll_mode,
        manual_d10_total=manual_d10_total,
        manual_d10_rolls=manual_d10_rolls,
    )


def print_result(data: AttackInput) -> None:
    band = range_band(data.distance_m, data.weapon_range_m)
    dc = RANGE_DCS[band]
    plan = fire_plan(data, band)
    rounds_per_target = int(plan.get("rounds_per_target", 0))
    fire_mod = mode_modifier(data.fire_mode, band, rounds_per_target)

    static_total = (
        data.shooter_ref
        + data.shooter_skill
        + data.weapon_accuracy
        + data.aim_rounds
        + data.smartgun_mod
        + data.extra_mod
        + (-4 if data.aimed_location else 0)
        + data.target_move_mod
        + fire_mod
    )

    print("\nResult")
    print("-" * 40)
    print(f"Weapon: {data.weapon_name}")
    print(f"Mode: {data.fire_mode}")
    print(f"Range band: {band} / DC {dc if not math.isinf(dc) else 'unreachable'}")
    if band == "point blank":
        print("Point blank rule: maximum weapon damage is used.")
    print(f"Available this round: {min(data.weapon_rof, data.shots_left)} rounds")

    if data.fire_mode == "suppressive":
        print(f"Rounds into zone: {plan['total_rounds']}")
        print(f"Fire-zone width: {plan['fire_zone_width_m']} m")
        print(f"Save number: {plan['save_number']} vs Athletics + REF + 1d10")
        print("On failed save: target takes 1d6 randomly located rounds.")
        return

    print(f"Rounds per target: {rounds_per_target}")
    print(f"Total rounds spent: {plan['total_rounds']}")
    print(f"Mode modifier: {fire_mod:+d}")
    if data.aimed_location:
        print(f"Aimed location: {LOCATION_LABELS[data.aimed_location]} / modifier -4")
    else:
        print("Hit location: random per hit")
    print(f"Ammo type: {'AP' if data.armor_piercing else 'normal'}")
    print(f"Attack before d10: {static_total}")

    chance = success_chance(static_total, int(dc))
    print(f"Estimated hit chance: {chance * 100:.1f}%")

    if data.fire_mode == "burst":
        print("On hit: hits = ceil(1d6 / 2), equivalent to 1d3.")

    if data.attack_roll_mode == "auto":
        d10_total, d10_rolls = roll_cp2020_d10()
    else:
        d10_total = data.manual_d10_total or 0
        d10_rolls = data.manual_d10_rolls or [d10_total]

    attack_total = static_total + d10_total
    margin = attack_total - dc

    if data.fire_mode == "fullauto":
        hits = max(0, min(rounds_per_target, int(margin)))
    elif data.fire_mode == "burst":
        hits = math.ceil(random.randint(1, 6) / 2) if margin >= 0 else 0
    else:
        hits = 1 if margin >= 0 else 0

    print("\nRoll")
    print(f"d10 rolls: {d10_rolls} => {d10_total}")
    print(f"Attack total: {attack_total} vs DC {dc} / margin {margin:+g}")
    print(f"Hits: {hits}")

    if hits:
        if band == "point blank":
            max_damage = parse_damage_max(data.damage)
            damage_rolls = [max_damage for _ in range(hits)]
        else:
            damage_rolls = [roll_damage(data.damage) for _ in range(hits)]
        if all(value is not None for value in damage_rolls):
            armor_by_location = {
                location: data.target_sp
                for location in LOCATION_LABELS
            }
            total_final_damage = 0

            print("\nDamage by hit")
            for index, raw_damage in enumerate(damage_rolls, start=1):
                if data.aimed_location:
                    location = data.aimed_location
                    location_roll = None
                else:
                    location, location_roll = roll_hit_location()

                current_sp = armor_by_location[location]
                if data.armor_piercing:
                    effective_sp = math.ceil(current_sp / 2)
                    penetrated = int(raw_damage) > effective_sp
                    after_armor = max(0, int(raw_damage) - effective_sp)
                    final_damage = max(0, math.ceil(after_armor / 2) + data.target_btm)
                    sp_text = f"SP {current_sp} / AP effective {effective_sp}"
                else:
                    effective_sp = current_sp
                    penetrated = int(raw_damage) > effective_sp
                    final_damage = max(0, int(raw_damage) - effective_sp + data.target_btm)
                    sp_text = f"SP {current_sp}"

                next_sp = max(0, current_sp - 1) if penetrated else current_sp
                armor_by_location[location] = next_sp
                total_final_damage += final_damage

                roll_text = f"loc d10 {location_roll}, " if location_roll is not None else ""
                armor_text = f"{current_sp}->{next_sp}" if penetrated else f"{current_sp}"
                print(
                    f"{index:>2}. {roll_text}{LOCATION_LABELS[location]}: "
                    f"raw {raw_damage} vs {sp_text}, "
                    f"{'penetrates' if penetrated else 'stopped'}, "
                    f"final {final_damage}, armor {armor_text}"
                )

            print(f"\nTotal rough damage after armor/BTM: {total_final_damage}")
            print("Remaining armor SP:")
            for location, label in LOCATION_LABELS.items():
                print(f"  {label}: {armor_by_location[location]}")
        else:
            avg = parse_damage_average(data.damage)
            if avg is not None:
                rough = max(0, avg - data.target_sp + data.target_btm)
                print(f"Average raw damage: {avg:.1f}")
                print(f"Rough average damage after SP/BTM: {rough:.1f}")


def main() -> None:
    data = collect_input()
    print_result(data)


if __name__ == "__main__":
    main()
