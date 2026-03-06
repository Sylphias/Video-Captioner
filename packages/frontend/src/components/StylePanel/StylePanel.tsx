import { HexColorPicker, HexColorInput } from 'react-colorful'
import { FONT_NAMES, getFontFamily } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import './StylePanel.css'

export function StylePanel() {
  // Use individual selectors to minimize re-renders
  const fontFamily = useSubtitleStore((s) => s.style.fontFamily)
  const fontSize = useSubtitleStore((s) => s.style.fontSize)
  const highlightColor = useSubtitleStore((s) => s.style.highlightColor)
  const baseColor = useSubtitleStore((s) => s.style.baseColor)
  const strokeWidth = useSubtitleStore((s) => s.style.strokeWidth)
  const strokeColor = useSubtitleStore((s) => s.style.strokeColor)
  const verticalPosition = useSubtitleStore((s) => s.style.verticalPosition)
  const lingerDuration = useSubtitleStore((s) => s.style.lingerDuration)
  const setStyle = useSubtitleStore((s) => s.setStyle)

  return (
    <div className="style-panel">
      {/* Font selector */}
      <div className="style-panel__section">
        <label className="style-panel__label">Font</label>
        <select
          className="style-panel__select"
          value={fontFamily}
          style={{ fontFamily }}
          onChange={(e) => setStyle({ fontFamily: e.target.value })}
        >
          {FONT_NAMES.map((name) => {
            const family = getFontFamily(name)
            return (
              <option key={name} value={family} style={{ fontFamily: family }}>
                {name}
              </option>
            )
          })}
        </select>
      </div>

      {/* Font size slider */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Font size <span className="style-panel__value">{fontSize}px</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={16}
          max={96}
          step={2}
          value={fontSize}
          onChange={(e) => setStyle({ fontSize: Number(e.target.value) })}
        />
      </div>

      {/* Highlight color */}
      <div className="style-panel__section">
        <label className="style-panel__label">Highlight color (active word)</label>
        <div className="style-panel__color-control">
          <HexColorPicker
            color={highlightColor}
            onChange={(color) => setStyle({ highlightColor: color })}
          />
          <div className="style-panel__hex-row">
            <span className="style-panel__hex-prefix">#</span>
            <HexColorInput
              className="style-panel__hex-input"
              color={highlightColor}
              onChange={(color) => setStyle({ highlightColor: color })}
              prefixed={false}
            />
          </div>
        </div>
      </div>

      {/* Base color */}
      <div className="style-panel__section">
        <label className="style-panel__label">Base color (inactive words)</label>
        <div className="style-panel__color-control">
          <HexColorPicker
            color={baseColor}
            onChange={(color) => setStyle({ baseColor: color })}
          />
          <div className="style-panel__hex-row">
            <span className="style-panel__hex-prefix">#</span>
            <HexColorInput
              className="style-panel__hex-input"
              color={baseColor}
              onChange={(color) => setStyle({ baseColor: color })}
              prefixed={false}
            />
          </div>
        </div>
      </div>

      {/* Stroke width slider */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Stroke width <span className="style-panel__value">{strokeWidth}px</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={0}
          max={4}
          step={0.5}
          value={strokeWidth}
          onChange={(e) => setStyle({ strokeWidth: Number(e.target.value) })}
        />
      </div>

      {/* Stroke color — only shown when strokeWidth > 0 */}
      {strokeWidth > 0 && (
        <div className="style-panel__section">
          <label className="style-panel__label">Stroke color</label>
          <div className="style-panel__color-control">
            <HexColorPicker
              color={strokeColor}
              onChange={(color) => setStyle({ strokeColor: color })}
            />
            <div className="style-panel__hex-row">
              <span className="style-panel__hex-prefix">#</span>
              <HexColorInput
                className="style-panel__hex-input"
                color={strokeColor}
                onChange={(color) => setStyle({ strokeColor: color })}
                prefixed={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Vertical position slider */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Vertical position <span className="style-panel__value">{verticalPosition}% from top</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={5}
          max={95}
          step={1}
          value={verticalPosition}
          onChange={(e) => setStyle({ verticalPosition: Number(e.target.value) })}
        />
      </div>

      {/* Linger duration slider */}
      <div className="style-panel__section">
        <label className="style-panel__label">
          Linger duration <span className="style-panel__value">{lingerDuration.toFixed(1)}s</span>
        </label>
        <input
          type="range"
          className="style-panel__slider"
          min={0}
          max={3}
          step={0.1}
          value={lingerDuration}
          onChange={(e) => setStyle({ lingerDuration: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
