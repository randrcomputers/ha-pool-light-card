/**
 * Pool Light Card — Home Assistant Lovelace (RGB light + optional BLE badge).
 */
(function () {
  const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
  const { html, css } = LitElement.prototype;

  const DEFAULTS = Object.freeze({
    image: "/local/pool_card/pool_light_fixture.png",
    image_control_box: "/local/pool_card/light_control_box.png",
    show_fixture_when: "auto",
    glow_top: 22,
    glow_left: 22,
    glow_size: 56,
    glow_brightness: 140,
  });

  const PRESETS = Object.freeze([
    { name: "Orange", rgb: [255, 120, 40] },
    { name: "Peach", rgb: [255, 190, 140] },
    { name: "Warm white", rgb: [255, 235, 200] },
    { name: "White", rgb: [255, 255, 255] },
    { name: "Sky", rgb: [120, 190, 255] },
    { name: "Lavender", rgb: [190, 160, 255] },
    { name: "Pink", rgb: [255, 170, 200] },
    { name: "Coral", rgb: [255, 100, 90] },
  ]);

  function num(config, key, fallback) {
    const v = config[key];
    if (v === undefined || v === null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function mergeConfig(config) {
    return {
      ...DEFAULTS,
      show_fixture_when: "auto",
      ...config,
    };
  }

  function showFixtureView(config, light) {
    const mode = config.show_fixture_when || "auto";
    if (mode === "always") return true;
    if (mode === "never") return false;
    return light.isOn;
  }

  function resolveArtwork(config, light) {
    const ctrl = (config.image_control_box || "").trim();
    const fixture = showFixtureView(config, light);
    if (!fixture && ctrl) {
      return { src: ctrl, showGlow: false, view: "control-box" };
    }
    return {
      src: config.image || DEFAULTS.image,
      showGlow: true,
      view: "fixture",
    };
  }

  function glowStrengthMul(config) {
    const b = num(config, "glow_brightness", DEFAULTS.glow_brightness);
    return Math.min(2.5, Math.max(0.25, b / 100));
  }

  function glowStyle(config, rgb, brightness, isOn) {
    const [r, g, b] = rgb;
    const top = num(config, "glow_top", DEFAULTS.glow_top);
    const left = num(config, "glow_left", DEFAULTS.glow_left);
    const size = num(config, "glow_size", DEFAULTS.glow_size);
    const strength = glowStrengthMul(config);
    const lightDim = isOn ? (brightness || 255) / 255 : 0;
    const dim = isOn ? Math.min(1, Math.max(0.2, lightDim * strength)) : 0;
    const a0 = Math.min(1, 0.95 * strength).toFixed(2);
    const a1 = Math.min(1, 0.6 * strength).toFixed(2);
    const a2 = Math.min(1, 0.22 * strength).toFixed(2);
    const bg = `radial-gradient(circle at 45% 40%, rgba(${r},${g},${b},${a0}) 0%, rgba(${r},${g},${b},${a1}) 38%, rgba(${r},${g},${b},${a2}) 62%, transparent 72%)`;
    return `
      --pl-glow-top:${top}%;
      --pl-glow-left:${left}%;
      --pl-glow-size:${size}%;
      --pl-glow-bg:${bg};
      --pl-dim:${dim.toFixed(3)};
      --pl-glow-filter:brightness(${strength.toFixed(2)});
      --pl-glow-shadow:0 0 36px rgba(${r},${g},${b},${Math.min(1, 0.7 * strength).toFixed(2)});
    `.trim();
  }

  function readLight(hass, entityId) {
    const st = entityId && hass?.states?.[entityId];
    if (!st) {
      return {
        ok: false,
        isOn: false,
        rgb: [255, 255, 255],
        brightness: 255,
        label: "Unavailable",
      };
    }
    const isOn = st.state === "on";
    const rgb = Array.isArray(st.attributes?.rgb_color)
      ? st.attributes.rgb_color.map((n) => Math.round(Number(n)) || 0)
      : [255, 255, 255];
    const brightness =
      st.attributes?.brightness != null
        ? Math.min(255, Math.max(1, Number(st.attributes.brightness) || 255))
        : isOn
          ? 255
          : 0;
    return {
      ok: true,
      isOn,
      rgb,
      brightness,
      label: isOn ? "On" : "Off",
    };
  }

  function bleConnected(hass, config) {
    if (config.entity_connected) {
      const st = hass.states[config.entity_connected];
      return st?.state === "on";
    }
    if (config.entity) {
      const st = hass.states[config.entity];
      return st && st.state !== "unavailable";
    }
    return false;
  }

  function rgbEqual(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }

  class PoolLightCard extends LitElement {
    static get properties() {
      return {
        hass: {},
        config: {},
        _busy: { state: false },
      };
    }

    static getConfigElement() {
      return document.createElement("pool-light-card-editor");
    }

    static getStubConfig() {
      return { type: "custom:pool-light-card" };
    }

    getCardSize() {
      return 5;
    }

    setConfig(config) {
      this.config = mergeConfig(config || {});
    }

    _entityId() {
      return this.config?.entity;
    }

    async _call(service, data) {
      const entity_id = this._entityId();
      if (!entity_id || this._busy) return;
      this._busy = true;
      try {
        await this.hass.callService("light", service, {
          entity_id,
          ...data,
        });
      } finally {
        this._busy = false;
      }
    }

    _togglePower() {
      this._call("toggle", {});
    }

    _setBrightness(ev) {
      const brightness = Number(ev.target.value);
      const light = readLight(this.hass, this._entityId());
      if (light.isOn) {
        this._call("turn_on", { brightness });
      } else {
        this._call("turn_on", {
          rgb_color: light.rgb,
          brightness,
        });
      }
    }

    _pickColor(rgb) {
      const light = readLight(this.hass, this._entityId());
      this._call("turn_on", {
        rgb_color: rgb,
        brightness: light.isOn ? light.brightness : 255,
      });
    }

    _pickCustom(ev) {
      const hex = ev.target.value;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      this._pickColor([r, g, b]);
    }

    render() {
      if (!this.hass || !this.config) return html``;

      const cfg = mergeConfig(this.config);
      const entityId = cfg.entity;

      if (!entityId) {
        return html`
          <ha-card>
            <div class="card setup-card">
              <p class="setup-msg">
                Choose a <strong>Light</strong> entity in the card options.
              </p>
            </div>
          </ha-card>
        `;
      }

      const light = readLight(this.hass, entityId);
      const title =
        cfg.name ||
        this.hass.states[entityId]?.attributes?.friendly_name ||
        "Pool light";
      const ble = bleConnected(this.hass, cfg);
      const [r, g, b] = light.rgb;
      const art = resolveArtwork(cfg, light);
      const glowCss = glowStyle(
        cfg,
        light.rgb,
        light.brightness,
        light.isOn && art.showGlow
      );

      return html`
        <ha-card>
          <div
            class="card ${light.isOn ? "on" : "off"} ${light.ok ? "" : "unavailable"} view-${art.view}"
          >
            <div class="header">
              <span class="title">${title}</span>
              <span
                class="ble ${ble ? "on" : ""}"
                title="${ble ? "Connected" : "Not connected"}"
              >
                ${this._bleIcon()}
              </span>
            </div>

            <div class="stage">
              <div
                class="fixture-wrap ${art.showGlow ? "has-glow" : "no-glow"}"
                style="${art.showGlow ? glowCss : ""}"
              >
                <img
                  class="fixture-img"
                  src="${art.src}"
                  alt=""
                  draggable="false"
                />
                ${art.showGlow
                  ? html`<div class="lens-glow" aria-hidden="true"></div>`
                  : ""}
              </div>
            </div>

            <label class="brightness-row">
              <span class="brightness-label">Brightness</span>
              <input
                type="range"
                min="1"
                max="255"
                .value=${String(light.brightness || 1)}
                ?disabled=${!light.ok || this._busy}
                @change=${this._setBrightness}
              />
            </label>

            <div class="swatches" role="group" aria-label="Colors">
              ${PRESETS.map(
                (p) => html`
                  <button
                    type="button"
                    class="swatch ${rgbEqual(light.rgb, p.rgb) ? "active" : ""}"
                    style="--swatch:${`rgb(${p.rgb.join(",")})`}"
                    title="${p.name}"
                    ?disabled=${!light.ok || this._busy}
                    @click=${() => this._pickColor(p.rgb)}
                  ></button>
                `
              )}
              <label class="swatch custom" title="Custom color">
                <input
                  type="color"
                  .value=${`#${[r, g, b]
                    .map((x) => x.toString(16).padStart(2, "0"))
                    .join("")}`}
                  ?disabled=${!light.ok || this._busy}
                  @change=${this._pickCustom}
                />
              </label>
            </div>

            <div class="footer">
              <div class="state-pill">
                <span
                  class="dot ${light.isOn ? "on" : ""}"
                  style=${light.isOn
                    ? `background: rgb(${r},${g},${b}); box-shadow: 0 0 10px rgba(${r},${g},${b},0.75)`
                    : ""}
                ></span>
                <span class="state-text">${light.label}</span>
              </div>
              <button
                type="button"
                class="power ${light.isOn ? "on" : ""}"
                ?disabled=${!light.ok || this._busy}
                @click=${this._togglePower}
                title="${light.isOn ? "Turn off" : "Turn on"}"
              >
                ${this._powerIcon()}
              </button>
            </div>
          </div>
        </ha-card>
      `;
    }

    _powerIcon() {
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3v9M8.5 5.5a7 7 0 1 0 7 0"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      `;
    }

    _bleIcon() {
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 12a6 6 0 0 1 12 0M9 12a3 3 0 0 1 6 0M12 12v3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
      `;
    }

    static get styles() {
      return css`
        :host {
          display: block;
        }
        ha-card {
          overflow: hidden;
        }
        .card {
          padding: 12px 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .setup-card {
          min-height: 120px;
          justify-content: center;
          text-align: center;
        }
        .setup-msg {
          margin: 0;
          color: var(--primary-text-color);
          font-size: 0.95rem;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--primary-text-color);
        }
        .ble {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--disabled-text-color);
          background: var(--secondary-background-color);
          transition:
            color 0.3s,
            background 0.3s,
            box-shadow 0.3s;
        }
        .ble.on {
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.15);
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.45);
        }
        .ble svg {
          width: 18px;
          height: 18px;
        }
        .stage {
          display: flex;
          justify-content: center;
          padding: 4px 0;
        }
        .fixture-wrap {
          position: relative;
          width: 100%;
          max-width: 220px;
          line-height: 0;
        }
        .view-control-box .fixture-wrap {
          max-width: 200px;
        }
        .view-control-box .fixture-img {
          max-height: 200px;
          object-fit: contain;
        }
        .fixture-img {
          width: 100%;
          height: auto;
          display: block;
          border-radius: 8px;
        }
        .lens-glow {
          position: absolute;
          top: var(--pl-glow-top, 22%);
          left: var(--pl-glow-left, 22%);
          width: var(--pl-glow-size, 56%);
          aspect-ratio: 1;
          border-radius: 50%;
          pointer-events: none;
          opacity: var(--pl-dim, 0);
          background: var(--pl-glow-bg);
          mix-blend-mode: screen;
          filter: blur(1px) brightness(var(--pl-glow-filter, 1));
          transition:
            opacity 0.35s ease,
            filter 0.35s ease;
        }
        .card.on .lens-glow {
          animation: glow-breathe 3s ease-in-out infinite;
        }
        .fixture-wrap.has-glow .lens-glow {
          box-shadow: var(--pl-glow-shadow, none);
        }
        .brightness-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brightness-label {
          font-size: 0.8rem;
          color: var(--secondary-text-color);
          flex-shrink: 0;
          width: 4.5rem;
        }
        .brightness-row input[type="range"] {
          flex: 1;
          accent-color: #38bdf8;
        }
        .swatches {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          justify-items: center;
        }
        .swatch {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid transparent;
          background: var(--swatch, #fff);
          cursor: pointer;
          padding: 0;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
          transition:
            transform 0.15s,
            border-color 0.15s,
            box-shadow 0.15s;
        }
        .swatch:hover:not(:disabled) {
          transform: scale(1.08);
        }
        .swatch:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .swatch.active {
          border-color: var(--primary-text-color);
          box-shadow:
            0 0 0 2px var(--card-background-color),
            0 0 12px var(--swatch);
        }
        .swatch.custom {
          position: relative;
          overflow: hidden;
          background: conic-gradient(
            #f00,
            #ff0,
            #0f0,
            #0ff,
            #00f,
            #f0f,
            #f00
          );
        }
        .swatch.custom input[type="color"] {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
          width: 100%;
          height: 100%;
          border: none;
          padding: 0;
        }
        .footer {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .state-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 20px;
          background: var(--secondary-background-color);
          flex: 1;
          min-width: 0;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--disabled-text-color);
          flex-shrink: 0;
        }
        .state-text {
          font-size: 0.9rem;
          color: var(--primary-text-color);
        }
        .power {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          transition:
            background 0.25s,
            box-shadow 0.25s,
            transform 0.15s;
          flex-shrink: 0;
        }
        .power:hover:not(:disabled) {
          transform: scale(1.05);
        }
        .power:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .power.on {
          background: #1d4ed8;
          color: #fff;
          box-shadow: 0 0 16px rgba(29, 78, 216, 0.55);
        }
        .power svg {
          width: 26px;
          height: 26px;
        }
        @keyframes glow-breathe {
          0%,
          100% {
            filter: blur(1px) brightness(0.92);
          }
          50% {
            filter: blur(2px) brightness(1.08);
          }
        }
      `;
    }
  }

  class PoolLightCardEditor extends LitElement {
    static get properties() {
      return { hass: {}, config: {} };
    }

    setConfig(config) {
      this.config = mergeConfig(config || {});
    }

    _valueChanged(ev) {
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: ev.detail.value },
        })
      );
    }

    render() {
      if (!this.hass) return html``;
      const merged = mergeConfig(this.config || {});
      return html`
        <ha-form
          .hass=${this.hass}
          .data=${merged}
          .schema=${[
            {
              name: "entity",
              selector: { entity: { domain: "light" } },
            },
            {
              name: "entity_connected",
              selector: { entity: { domain: "binary_sensor" } },
            },
            { name: "name", selector: { text: {} } },
            { name: "image", selector: { text: {} } },
            { name: "image_control_box", selector: { text: {} } },
            {
              name: "show_fixture_when",
              type: "select",
              options: [
                ["auto", "Auto (fixture on, control box off)"],
                ["always", "Always show fixture"],
                ["never", "Always show control box"],
              ],
            },
            {
              name: "glow_top",
              selector: {
                number: { mode: "box", min: 0, max: 100, step: 0.5 },
              },
            },
            {
              name: "glow_left",
              selector: {
                number: { mode: "box", min: 0, max: 100, step: 0.5 },
              },
            },
            {
              name: "glow_size",
              selector: {
                number: { mode: "box", min: 10, max: 100, step: 0.5 },
              },
            },
            {
              name: "glow_brightness",
              selector: {
                number: { mode: "box", min: 25, max: 250, step: 5 },
              },
            },
          ]}
          .computeLabel=${(s) =>
            ({
              entity: "Light entity",
              entity_connected: "Connected (optional BLE sensor)",
              name: "Card title override",
              image: "Fixture image URL (light on)",
              image_control_box: "Control box image URL (light off)",
              show_fixture_when: "Fixture vs control box",
              glow_top: "Lens glow — top %",
              glow_left: "Lens glow — left %",
              glow_size: "Lens glow — size %",
              glow_brightness: "Lens glow — brightness %",
            })[s.name] || s.name}
          @value-changed=${this._valueChanged}
        ></ha-form>
      `;
    }
  }

  customElements.define("pool-light-card", PoolLightCard);
  customElements.define("pool-light-card-editor", PoolLightCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "pool-light-card",
    name: "Pool Light Card",
    description:
      "RGB pool light card with fixture artwork, brightness, presets, and BLE badge",
    preview: true,
    documentationURL:
      "https://github.com/randrcomputers/ha-pool-light-card#readme",
  });
})();
