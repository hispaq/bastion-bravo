# -*- coding: utf-8 -*-
"""
Lista completa de recursos graficos de Bastion Bravo.

Cada recurso es un dict con:
  key          clave del manifiesto (BB.SPRITES[key]), p. ej. "hero_arquera"
  cat          categoria (enemies, heroes, bosses, castle, towers, bg, map, ui, icons, app)
  name         id corto (arquera, troll, ...)
  out          ruta de salida relativa al proyecto (con /)
  prompt       prompt completo (en ingles)
  aspect       square | wide | tall | bg | map | title  (generate.py lo traduce a pixeles)
  facing       orientacion esperada en el archivo final: "left" | "right" | None
  transparent  True si el PNG final lleva transparencia (se quita el fondo blanco)
  fit          ("max", lado)  -> recortado al contenido y lado mayor <= lado
               ("exact", (w, h)) -> recorte tipo "cover" a ese tamano exacto
  group        True si la imagen tiene varias piezas a proposito (jinete + montura...)
  seed         semilla por defecto (determinista); tools/seeds.json la sobrescribe
  extra_out    [(ruta, (w, h))] salidas adicionales (icono de la app 192 px)

Uso:  from assets import ASSETS, select
"""
import zlib
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
RAW_DIR = TOOLS / "raw"
REVIEW_DIR = TOOLS / "review"
SPRITES_DIR = ROOT / "sprites"

# Orden de prioridad de generacion
CATEGORY_ORDER = ["enemies", "heroes", "bosses", "castle", "towers",
                  "bg", "map", "icons", "ui", "app"]

# ---------------------------------------------------------------------------
# Estilo comun (docs/DISENO.md, seccion 5)
# ---------------------------------------------------------------------------
STYLE_SPRITE = ("2D cartoon mobile game sprite, side view, full body, bold clean black outlines, "
                "vibrant saturated colors, soft cel shading, heroic fantasy, centered, "
                "isolated on plain white background, no text, no watermark")
STYLE_BUILDING = ("2D cartoon mobile game sprite, side view, bold clean black outlines, "
                  "vibrant saturated colors, soft cel shading, heroic fantasy, centered, "
                  "isolated on plain white background, no text, no watermark")
STYLE_BG = ("2D cartoon mobile game background, side-scrolling landscape panorama, vibrant colors, "
            "bold outlines, painterly cel shading, empty flat ground strip at the bottom, "
            "no characters, no text, no watermark")
STYLE_MAP = ("2D cartoon fantasy world map region seen from above, top-down illustrated game map, "
             "vibrant colors, bold outlines, no text, no labels, no watermark")
STYLE_ICON = ("2D cartoon mobile game icon, bold black outline, vibrant glossy colors, centered, "
              "isolated on plain white background, no text")

FACING_TXT = {
    "left": "facing left, profile view turned toward the left side of the picture",
    "right": "facing right, profile view turned toward the right side of the picture",
}
ONE_CHAR = ("one single character only, one pose, the entire figure visible from head to feet "
            "with white space around it, nothing cut off, no ground, no floor, no shadow")
GROUP = ("one single group only, the entire subject visible with white space around it, "
         "nothing cut off, no ground, no floor, no shadow")
GOBLIN = "green skin, long pointy ears, sharp teeth, yellow eyes"
ORC = "green skin, big tusks, brutish face"


def _seed(key):
    return zlib.crc32(key.encode("utf-8")) % 1_000_000


def _sprite(cat, prefix, folder, name, subject, facing, *, aspect="square", maxside=384,
            group=False, style=STYLE_SPRITE, extra=""):
    parts = [f"{subject}, {FACING_TXT[facing]}" if facing else subject, style,
             GROUP if group else ONE_CHAR]
    if extra:
        parts.append(extra)
    key = f"{prefix}_{name}"
    return dict(key=key, cat=cat, name=name, out=f"sprites/{folder}/{name}.png",
                prompt=", ".join(parts), aspect=aspect, facing=facing, transparent=True,
                fit=("max", maxside), group=group, seed=_seed(key), subject=subject)


# ---------------------------------------------------------------------------
# ENEMIGOS (miran a la DERECHA)
# ---------------------------------------------------------------------------
ENEMIES = [
    ("goblin_veloz", f"a small skinny goblin ({GOBLIN}) running fast with a rusty dagger, ragged brown loincloth", {}),
    ("orco_escudo", f"a green orc warrior ({ORC}) holding a huge round wooden shield with an iron rim in front of him and a short sword, leather armor", {}),
    ("goblin_bombardero", f"a huge round black cannonball bomb with a lit sparkling fuse strapped on the back of a small crazy running goblin ({GOBLIN}), wild grin", {}),
    ("goblin_planeador", f"a goblin ({GOBLIN}) flying in the air with big brown leather bat-like glider wings strapped to his arms, aviator goggles", {}),
    ("jinete_lobo", f"a goblin rider ({GOBLIN}) riding a big grey wolf, the wolf charging forward with open jaws", {"aspect": "wide", "group": True}),
    ("chaman", f"an old orc shaman ({ORC}) wearing a feathered skull mask, hunched, holding a wooden staff with a glowing green healing light", {}),
    ("goblin_arquero", f"full body small goblin archer ({GOBLIN}) standing and aiming a crude short wooden bow, quiver of arrows, legs and feet visible", {}),
    ("orco_berserker", "a muscular red-skinned orc berserker with big tusks and wild black hair, holding two axes, furious", {}),
    ("orco_tambor", f"a big fat orc drummer ({ORC}) with a large war drum on his belly, beating it with two bone drumsticks", {}),
    ("goblin_topo", f"a goblin sapper ({GOBLIN}) with a miner helmet with a candle, carrying a shovel, dirty clothes", {}),
    ("troll", "a huge hunched mossy green troll standing alone, moss on his back, long arms, holding a big wooden club", {"aspect": "square"}),
    ("orco_ariete", f"two orcs ({ORC}) carrying a big horizontal wooden log battering ram with an iron ram head on their shoulders", {"aspect": "wide", "group": True}),
]

# ---------------------------------------------------------------------------
# HEROES (miran a la IZQUIERDA)
# ---------------------------------------------------------------------------
HEROES = [
    ("arquera", "a young female archer in a green hooded cloak and leather armor, drawing a wooden longbow and aiming", {}),
    ("mago_fuego", "a bearded fire wizard in red and orange robes holding a wooden staff topped with a flaming orb", {}),
    ("maga_hielo", "full body young ice sorceress standing, long light blue robes and boots, holding a tall ice crystal staff, small snowflakes", {}),
    ("ballestero", "a stocky crossbowman in steel plate armor aiming a heavy crossbow", {}),
    ("sacerdote", "a kind old priest healer with a white beard in white and gold robes holding an open glowing holy book", {}),
    ("ingeniero", "a dwarf engineer with brass goggles and a big beard standing behind a small brass cannon on wooden wheels, the cannon pointing forward", {"group": True}),
    ("hechicera_rayo", "full body storm sorceress woman standing, long purple robes, white hair, blue lightning sparks between her hands", {}),
    ("druida", "full body old druid man standing, small deer antlers, brown beard, leafy green cloak, wooden staff with vines", {}),
    ("alquimista", "a cheerful alchemist with goggles and a leather apron throwing a bubbling green potion flask", {}),
    ("martillo", "a muscular dwarf warrior with a braided red beard holding a big throwing war hammer", {}),
    ("bardo", "a bard with a feathered hat and a colorful outfit playing a lute", {}),
    ("brujo", "a warlock in dark purple hooded robes holding a staff topped with a glowing green skull", {}),
    ("halconera", "a female falconer with a thick leather glove and a brown hawk perched on her raised arm", {"group": True}),
    ("arcano", "an arcane mage in dark blue robes decorated with stars, with three glowing magic orbs floating around his hands", {}),
    ("granadero", "full body medieval fantasy dwarf bomber with leather vest and bandolier of round black cartoon bombs, holding a bomb with lit fuse", {}),
    ("cazadora", "a female monster hunter with a fur cloak holding a big harpoon gun", {}),
    ("monje_viento", "full body bald wind monk man standing, orange and teal monk robes, sandals, white wind swirls around his hands", {}),
    ("envenenadora", "a female poison mistress in dark green clothes and hood holding a blowpipe, poison vials on her belt", {}),
    ("sacerdotisa_sol", "full body sun priestess woman standing, white and golden armor, holding a golden staff topped with a small sun", {}),
    ("mosquetera", "a female musketeer with a feathered hat and a red coat holding a long musket", {}),
]

# ---------------------------------------------------------------------------
# JEFES (miran a la DERECHA, grandes e imponentes)
# ---------------------------------------------------------------------------
BOSS_TXT = "huge imposing boss monster, menacing, highly detailed"
BOSSES = [
    ("rey_goblin", f"a fat goblin king ({GOBLIN}) with a golden crown and a red cape sitting on a big wooden throne with wheels", {"group": True}),
    ("chaman_gigante", f"a giant orc shaman ({ORC}) with glowing green eyes, bone necklaces and a huge staff topped with a skull, feathers and tribal paint", {}),
    ("troll_piedra", "a gigantic troll made of grey rock and boulders with glowing orange lava cracks, huge stone fists", {}),
    ("escorpion", "giant scorpion monster with two big claws and curved stinger tail raised over its back, golden armored shell, a green goblin warrior riding on its back", {"aspect": "wide", "group": True}),
    ("senor_fuego", f"an orc fire lord ({ORC}) wearing molten black and orange lava armor, wielding a huge flaming greatsword", {}),
    ("senor_guerra", f"a massive orc warlord ({ORC}) in black spiked plate armor with a horned helmet and a giant battle axe", {}),
    ("gigante_escarcha", "a huge frost ogre with icy blue skin, ice crystals growing on his shoulders, white beard, holding a big ice club", {}),
    ("nigromante", f"an orc necromancer ({ORC}) in tattered black robes floating above the ground, holding a staff with a glowing purple soul flame, purple ghostly wisps", {}),
    ("golem", "a giant steampunk war golem machine made of brass and iron with cannons on its shoulders, a small green goblin pilot in the cockpit on its chest", {"group": True}),
    ("dragon", f"a huge red war dragon flying with wings spread, an armored orc rider ({ORC}) on its back", {"aspect": "wide", "group": True}),
]

# ---------------------------------------------------------------------------
# CASTILLO (5 etapas, vista lateral, puerta hacia la izquierda)
# ---------------------------------------------------------------------------
CASTLE_TXT = ("flat side elevation view, the main gate on the left side of the building, "
              "the whole building visible with white space around it, nothing cut off, "
              "no ground, no people, no shadow")
CASTLES = [
    (1, "a small wooden fort with a wooden palisade wall and a tall wooden watchtower"),
    (2, "a stone keep with wooden roofs and a small stone tower"),
    (3, "a stone castle with two towers, blue banners and battlements"),
    (4, "a large stone fortress with tall towers, gold trims and many blue banners"),
    (5, "one big white stone royal castle with golden roofs, blue flags and a glowing blue crystal on top"),
]

# ---------------------------------------------------------------------------
# TORRES Y TRAMPAS
# ---------------------------------------------------------------------------
TOWER_TXT = "the whole object visible with white space around it, nothing cut off, no characters, no shadow"
TOWERS = [
    ("pinchos", "a spike trap: a row of sharp iron spikes sticking up from one long flat wooden plank, low and flat", None, "wide"),
    ("catapulta", "a classic wooden medieval catapult on four wheels with a long throwing arm and a stone in its bucket", "left", "square"),
    ("rayos", "a stone tower with a glowing blue crystal on top crackling with lightning", None, "tall"),
    ("flechas", "a small wooden archer tower with a mounted ballista on top", "left", "tall"),
    ("brea", "one single low rectangular wooden box frame filled with bubbling black tar, tar pit trap, low and flat", None, "wide"),
    ("barricada", "a wooden barricade: a row of sharpened wooden stakes crossed in X shapes and tied with rope, cheval de frise", "left", "wide"),
]

# ---------------------------------------------------------------------------
# ZONAS (fondos de combate y mapa)
# ---------------------------------------------------------------------------
ZONES = [
    ("bosque", "lush green forest, tall trees, sunny meadow",
     "a lush green emerald forest region with dense round tree canopies, sunny meadows, a small river and clearings"),
    ("pantano", "misty swamp, twisted dead trees, murky green water, fireflies",
     "a misty swamp region with murky green water, twisted dead trees, mossy islands and reeds"),
    ("montanas", "rocky grey mountains, snowy peaks, pine trees",
     "a rocky grey mountain region with snowy peaks, cliffs, pine forests and narrow valleys"),
    ("desierto", "golden sand dunes, cactus, ancient ruins, hot sun",
     "a golden sand desert region with dunes, cactus, an oasis and ancient sandstone ruins"),
    ("volcan", "erupting volcano, lava rivers, dark red sky",
     "a volcanic region with black rocks, glowing lava rivers, ash fields and an erupting volcano crater"),
    ("oscuras", "dark gloomy lands, dead trees, purple sky, orc banners",
     "a dark gloomy wasteland region with dead trees, purple fog, spiky rocks and orc war camps with banners"),
    ("hielo", "frozen peaks, snow fields, ice crystals, pale blue sky",
     "a frozen arctic region with snow fields, frozen lakes, icy cliffs and big blue ice crystals"),
    ("ruinas", "haunted ancient stone ruins, broken pillars, green ghostly mist, night",
     "a haunted region with ancient broken stone ruins, toppled pillars, graves and green ghostly mist at night"),
    ("forja", "goblin industrial fortress, chimneys, smoke, gears, metal walls, orange sky",
     "a goblin industrial region with iron forges, smoking chimneys, metal walls, gears, pipes and rails"),
    ("dragon", "dragon lair mountain, giant bones, lava, stormy red sky",
     "a dragon lair region with jagged dark mountains, giant dragon bones, lava pools and scorched earth"),
]

# ---------------------------------------------------------------------------
# ICONOS
# ---------------------------------------------------------------------------
ICONS = [
    ("gold", "a shiny gold coin with an embossed crown"),
    ("gem", "a shiny glowing purple faceted gem"),
    ("star", "a shiny golden star"),
    ("lock", "a golden padlock"),
    ("heart", "a glossy red heart"),
    ("sword", "one single steel sword with a golden hilt pointing up"),
    ("shield", "a blue knight shield with a golden rim"),
    ("castle", "a tiny stone castle with blue flags"),
    ("trophy", "a golden trophy cup with two handles"),
    ("gift", "a red gift box with a golden ribbon bow"),
    ("scroll", "a rolled parchment scroll"),
    ("skull", "an orc skull with two big tusks"),
    ("lightning", "a yellow lightning bolt"),
    ("fire", "an orange and yellow fire flame"),
    ("snow", "a light blue snowflake"),
    ("potion", "one single round glass potion bottle with red liquid and a cork"),
    ("hammer", "a blacksmith hammer with a wooden handle"),
    ("map", "a rolled-up parchment treasure map"),
    ("settings", "a grey metal gear cogwheel"),
    ("play", "a round green play button with a white triangle pointing to the right"),
]


def _build():
    out = []
    for name, subject, opt in ENEMIES:
        out.append(_sprite("enemies", "enemy", "enemies", name, subject, "right", **opt))
    for name, subject, opt in HEROES:
        out.append(_sprite("heroes", "hero", "heroes", name, subject, "left", **opt))
    for name, subject, opt in BOSSES:
        opt = dict(opt)
        out.append(_sprite("bosses", "boss", "bosses", name, f"{subject}, {BOSS_TXT}", "right",
                           maxside=640, **opt))
    for n, subject in CASTLES:
        key = f"castle_{n}"
        out.append(dict(key=key, cat="castle", name=str(n), out=f"sprites/castle/castle_{n}.png",
                        prompt=f"{subject}, {STYLE_BUILDING}, {CASTLE_TXT}", aspect="square",
                        facing="left", transparent=True, fit=("max", 768), group=True, seed=_seed(key), subject=subject))
    for name, subject, facing, aspect in TOWERS:
        key = f"tower_{name}"
        subj = f"{subject}, {FACING_TXT[facing]}" if facing else subject
        out.append(dict(key=key, cat="towers", name=name, out=f"sprites/towers/{name}.png",
                        prompt=f"{subj}, {STYLE_BUILDING}, {TOWER_TXT}", aspect=aspect, facing=facing,
                        transparent=True, fit=("max", 384), group=True, seed=_seed(key), subject=subject))
    for zid, bg_desc, _ in ZONES:
        key = f"bg_{zid}"
        out.append(dict(key=key, cat="bg", name=zid, out=f"sprites/bg/{zid}.jpg",
                        prompt=(f"{STYLE_BG}, {bg_desc}, wide panoramic view with the horizon at the middle "
                                f"height of the image, the bottom quarter of the image is a flat empty ground strip"),
                        aspect="bg", facing=None, transparent=False, fit=("exact", (1600, 720)),
                        group=True, seed=_seed(key), subject=bg_desc))
    for zid, _, map_desc in ZONES:
        key = f"map_{zid}"
        out.append(dict(key=key, cat="map", name=zid, out=f"sprites/map/{zid}.jpg",
                        prompt=(f"{STYLE_MAP}, {map_desc}, seen from directly above, the terrain fills the whole "
                                f"image and continues beyond the left and right edges, no roads, no frame, no compass"),
                        aspect="map", facing=None, transparent=False, fit=("exact", (1280, 720)),
                        group=True, seed=_seed(key), subject=map_desc))
    for name, desc in ICONS:
        key = f"icon_{name}"
        out.append(dict(key=key, cat="icons", name=name, out=f"sprites/icons/{name}.png",
                        prompt=f"{desc}, {STYLE_ICON}, one single object, simple readable shape, no shadow",
                        aspect="square", facing=None, transparent=True, fit=("max", 256),
                        group=False, seed=_seed(key), subject=desc))
    out.append(dict(key="title_art", cat="ui", name="title_art", out="sprites/ui/title_art.jpg",
                    prompt=("Epic 2D cartoon mobile game key art illustration: a heroic stone castle with blue banners "
                            "on the right side of the image, defended by fantasy heroes on its walls (an archer, a fire "
                            "wizard, a dwarf with a hammer), while a big horde of green orcs and goblins charges from the "
                            "left side across a green battlefield, dramatic sunset sky, vibrant saturated colors, "
                            "bold clean black outlines, soft cel shading, heroic fantasy, no text, no title, no logo, "
                            "no watermark"),
                    aspect="title", facing=None, transparent=False, fit=("exact", (1600, 900)),
                    group=True, seed=_seed("title_art")))
    out.append(dict(key="app_icon", cat="app", name="app_icon", out="sprites/icons/app_icon_512.png",
                    prompt=("Mobile game app icon: a heroic stone castle tower with a blue and gold heraldic shield in "
                            "front of it, centered, the artwork fills the whole square image, solid rich blue "
                            "background, 2D cartoon style, bold black outlines, vibrant glossy colors, soft cel shading, "
                            "no text, no letters, no border, no watermark"),
                    aspect="square", facing=None, transparent=False, fit=("exact", (512, 512)),
                    group=True, seed=_seed("app_icon"),
                    extra_out=[("sprites/icons/app_icon_192.png", (192, 192))]))
    return out


# ---------------------------------------------------------------------------
# Prompts compactos para Stable Diffusion local (CLIP corta a 77 tokens: sujeto primero,
# estilo despues; lo que se quiere evitar va en el prompt negativo).
# ---------------------------------------------------------------------------
SD_STYLE = ("2d cartoon mobile game art, bold clean black outlines, flat vibrant saturated colors, "
            "soft cel shading, heroic fantasy, isolated on plain white background")
SD_CHAR = "full body, side view, single character, on a plain pure white background"
SD_NEG_SPRITE = ("text, watermark, signature, logo, blurry, multiple characters, two characters, crowd, "
                 "character sheet, multiple views, cropped, cut off, deformed, bad anatomy, extra limbs, "
                 "photo, realistic, 3d render, frame, border, ground, floor, shadow, scenery, grey background, "
                 "gradient background, circle, vignette, sticker, black bar")
SD_NEG_SCENE = ("text, watermark, signature, logo, letters, words, blurry, people, characters, person, "
                "frame, border, photo, realistic, 3d render, deformed, ui")
SD_FACING = {"left": "facing left", "right": "facing right"}


def _sd(a):
    s = a.get("subject", "")
    s = s.replace(f" ({GOBLIN})", " with green skin and pointy ears").replace(f" ({ORC})", " with green skin and tusks")
    s = s.replace(f", {BOSS_TXT}", ", huge imposing boss monster")
    f = SD_FACING.get(a.get("facing"), "")
    cat = a["cat"]
    if cat in ("enemies", "heroes", "bosses"):
        p = f"{s}, {f}, {SD_CHAR}, {SD_STYLE}"
        n = SD_NEG_SPRITE
        if a.get("group"):
            p = p.replace("single character", "single group")
            n = n.replace("multiple characters, two characters, ", "")
    elif cat in ("castle", "towers"):
        p = (f"{s}, {f + ', ' if f else ''}game asset cut out on white, no sky, no mountains, "
             f"colorful full color 2d cartoon game building, side view, entire building visible, "
             f"isolated on plain pure white background, bold black outlines, vibrant saturated colors, cel shading")
        n = SD_NEG_SPRITE.replace("bad anatomy, extra limbs, ", "") + ", people, sky, clouds, landscape, sketch, line art, monochrome"
    elif cat == "icons":
        p = f"{s}, game icon, centered, single object, on a plain pure white background, {SD_STYLE}"
        n = SD_NEG_SPRITE.replace("bad anatomy, extra limbs, ", "") + ", multiple objects"
    elif cat == "bg":
        p = (f"{s}, 2d cartoon side-scrolling game background, wide landscape panorama, horizon in the middle, "
             f"flat empty ground at the bottom, vibrant colors, bold outlines, painterly cel shading")
        n = SD_NEG_SCENE
    elif cat == "map":
        p = (f"{s}, top-down view, illustrated fantasy game world map, 2d cartoon, vibrant colors, "
             f"bold outlines, terrain fills the whole image")
        n = SD_NEG_SCENE + ", compass, legend, labels, roads"
    elif cat == "ui":
        p = ("epic 2d cartoon game key art, heroic stone castle with blue banners on the right, fantasy heroes "
             "on the walls, horde of green orcs and goblins charging from the left, battlefield, dramatic sunset "
             "sky, vibrant colors, bold black outlines, cel shading")
        n = SD_NEG_SCENE.replace("people, characters, person, ", "") + ", title"
    else:  # app
        p = ("mobile game app icon, heroic stone castle tower with a blue and gold heraldic shield, centered, "
             "solid rich blue background, 2d cartoon, bold black outlines, vibrant glossy colors, cel shading")
        n = SD_NEG_SCENE + ", rounded corners, white background"
    return p, n


ASSETS = _build()
for _a in ASSETS:
    _a["sd_prompt"], _a["negative"] = _sd(_a)
BY_KEY = {a["key"]: a for a in ASSETS}


def select(only=None, category=None):
    """Filtra recursos. `only`: lista de claves ("hero_arquera") o ids cortos ("arquera").
    `category`: lista de categorias. Devuelve la lista en orden de prioridad."""
    items = ASSETS
    if category:
        cats = set(category)
        unknown = cats - set(CATEGORY_ORDER)
        if unknown:
            raise SystemExit(f"Categoria desconocida: {', '.join(sorted(unknown))}. "
                             f"Validas: {', '.join(CATEGORY_ORDER)}")
        items = [a for a in items if a["cat"] in cats]
    if only:
        wanted = []
        for token in only:
            token = token.strip()
            if not token:
                continue
            if token in BY_KEY:
                wanted.append(token)
                continue
            matches = [a["key"] for a in ASSETS if a["name"] == token]
            if not matches:
                raise SystemExit(f"Recurso desconocido: {token}")
            wanted.extend(matches)
        items = [a for a in items if a["key"] in set(wanted)]
    order = {c: i for i, c in enumerate(CATEGORY_ORDER)}
    return sorted(items, key=lambda a: order[a["cat"]])  # sort estable: respeta el orden de la lista


def raw_path(asset, ext=None):
    """Ruta del original descargado (busca cualquier extension si ext es None)."""
    if ext:
        return RAW_DIR / f"{asset['key']}.{ext}"
    for e in ("png", "jpg", "webp"):
        p = RAW_DIR / f"{asset['key']}.{e}"
        if p.exists():
            return p
    return None


def out_path(asset):
    return ROOT / asset["out"]


if __name__ == "__main__":
    from collections import Counter
    c = Counter(a["cat"] for a in ASSETS)
    print(f"{len(ASSETS)} recursos:", dict(c))
    for a in ASSETS:
        print(f"{a['key']:28s} {a['cat']:8s} {a['aspect']:6s} {str(a['facing']):5s} {a['out']}")
