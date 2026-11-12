// Accessible on/off switch (role="switch"); state is also spelled out in text, never colour alone.
export default function ToggleSwitch({ checked, onChange, label, disabled, isBusy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' is-on' : ''}${isBusy ? ' is-busy' : ''}`}
      disabled={disabled || isBusy}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
      <span className="switch-text" aria-hidden="true">
        {checked ? 'On' : 'Off'}
      </span>
    </button>
  );
}
