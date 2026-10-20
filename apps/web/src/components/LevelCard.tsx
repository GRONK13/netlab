/** Progress drawn as a row of port LEDs, like the front of a switch. */
export function LedMeter({ lit, total, label }: { lit: number; total: number; label?: string }) {
  return (
    <span className="leds" role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={lit} aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < lit ? 'on' : undefined} />
      ))}
    </span>
  );
}
