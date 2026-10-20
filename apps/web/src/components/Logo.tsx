/** NetLab wordmark: a terminal prompt mark plus "netlab" in mono. */
export function Logo({ word = true }: { word?: boolean }) {
  return (
    <span className="wordmark">
      <span className="mark" aria-hidden="true">
        &gt;<span className="cursor">_</span>
      </span>
      {word && <span className="word">netlab</span>}
    </span>
  );
}
