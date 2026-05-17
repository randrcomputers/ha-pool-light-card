# Pool Light Card

Lovelace card for any **RGB `light`** entity — fixture artwork, color presets, brightness slider, power toggle, and a BLE-style connectivity badge (same look as the [Pool Cleaner Card](https://github.com/randrcomputers/ha-pool-cleaner-card)).

Works with **[iPool Light](https://github.com/randrcomputers/ha-ipool-light)** and other RGB pool lights.

![Pool light card preview](media/preview.png)

## Install

1. **HACS** → **Frontend** → **Custom repositories** → add `https://github.com/randrcomputers/ha-pool-light-card`
2. **Frontend** → **Pool Light Card** → **Download**
3. **Settings** → **Dashboards** → **⋮** → **Reload resources**, then refresh the browser (**Ctrl+F5**)

## Fixture image

Copy **`pool_card/pool_light.png`** → **`config/www/pool_card/pool_light.png`** on Home Assistant.

| Setting | Example |
| --- | --- |
| Fixture image URL | `/local/pool_card/pool_light.png` |

If the colored glow does not line up with your lens, adjust **Lens glow — top / left / size %** in the card editor.

## Add the card

Pick your **Light** entity in the UI, or YAML:

```yaml
type: custom:pool-light-card
entity: light.ipool_light
image: /local/pool_card/pool_light.png
```

Optional **Connected** binary sensor lights the BLE badge when `on` (otherwise the badge follows whether the light entity is available).

---

**Requirements:** Home Assistant 2024.1+ and a `light` entity with `rgb` color mode.
