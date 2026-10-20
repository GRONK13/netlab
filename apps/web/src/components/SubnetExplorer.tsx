import { ipToInt, isIp, parseCidr, prefixToMask, subnetOf } from '@netlab/sim';
import { useId, useState } from 'react';

const ORDINAL = ['1st', '2nd', '3rd', '4th'];

function Bits({ value, prefix, label }: { value: number; prefix: number; label: string }) {
  return (
    <div className="bits-row">
      <span className="label-caps">{label}</span>
      <span className="bits" aria-label={`${label} in binary`}>
        {[0, 1, 2, 3].map((o) => (
          <span key={o} className="octet">
            {Array.from({ length: 8 }, (_, b) => {
              const i = o * 8 + b;
              const bit = (value >>> (31 - i)) & 1;
              return (
                <i key={b} className={i < prefix ? 'net' : 'host'}>
                  {bit}
                </i>
              );
            })}
            <small>{(value >>> (24 - o * 8)) & 255}</small>
          </span>
        ))}
      </span>
    </div>
  );
}

/** Interactive address explorer for lessons: bits, mask, network, broadcast and range. */
export function SubnetExplorer({ initial = '192.168.1.130/24' }: { initial?: string }) {
  const start = parseCidr(initial) ?? { ip: '192.168.1.130', prefix: 24 };
  const [ip, setIp] = useState(start.ip);
  const [prefix, setPrefix] = useState(start.prefix);
  const id = useId();
  const address = ip.trim();
  const valid = isIp(address);
  const s = valid ? subnetOf(address, prefix) : null;
  const partial = prefix % 8 !== 0;

  return (
    <figure className="explorer">
      <div className="explorer-inputs">
        <label htmlFor={`${id}-ip`}>
          <span className="label-caps">Address</span>
          <input
            id={`${id}-ip`}
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            inputMode="decimal"
            maxLength={15}
            aria-invalid={!valid}
          />
        </label>
        <label htmlFor={`${id}-prefix`} className="grow">
          <span className="label-caps">
            Prefix <b className="mono">/{prefix}</b>
          </span>
          <input
            id={`${id}-prefix`}
            type="range"
            min={0}
            max={32}
            value={prefix}
            onChange={(e) => setPrefix(Number(e.target.value))}
          />
        </label>
      </div>

      {!s ? (
        <p className="muted small">Type an address like 192.168.1.130.</p>
      ) : (
        <>
          <Bits value={ipToInt(address)} prefix={prefix} label="Address" />
          <Bits value={ipToInt(prefixToMask(prefix))} prefix={prefix} label="Mask" />
          <p className="bits-legend small muted">
            <i className="net" /> network bits ({prefix}) <i className="host" /> host bits (
            {32 - prefix})
          </p>
          <dl className="explorer-facts">
            <div>
              <dt>Mask</dt>
              <dd className="mono">{s.mask}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd className="mono">{s.network}</dd>
            </div>
            <div>
              <dt>Broadcast</dt>
              <dd className="mono">{s.broadcast}</dd>
            </div>
            <div>
              <dt>Usable range</dt>
              <dd className="mono">
                {s.first} – {s.last}
              </dd>
            </div>
            <div>
              <dt>Usable hosts</dt>
              <dd className="mono">{s.hosts.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt>Block size</dt>
              <dd className="mono">
                {partial
                  ? `${2 ** (8 - (prefix % 8))} in the ${ORDINAL[Math.floor(prefix / 8)]} octet`
                  : 'on an octet boundary'}
              </dd>
            </div>
          </dl>
        </>
      )}
    </figure>
  );
}
