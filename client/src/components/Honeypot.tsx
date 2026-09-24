// A field no real visitor ever sees or fills in — positioned off-screen rather than
// display:none, since some bots specifically skip display:none fields when filling forms.
// If it comes back non-empty, the server rejects the submission (see isHoneypotFilled on
// the server). tabIndex=-1 and autoComplete="off" keep it out of keyboard tab order and
// browser autofill, so a real person navigating by keyboard never lands on it either.
export default function Honeypot({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden="true">
      <label htmlFor="website">Website</label>
      <input
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
