import { isEndpoint, modelInfo, shortName, type Network } from '@netlab/sim';
import { Cable, Monitor, SquareTerminal, Trash2, X } from 'lucide-react';
import { DeviceGlyph } from './DeviceIcon.tsx';
import type { Selection } from './TopologyCanvas.tsx';

interface Props {
  net: Network;
  selection: Selection;
  onClose: () => void;
  onOpen: (id: string) => void;
  /** Sandbox only. */
  onDeleteDevice?: (id: string) => void;
  onDeleteLink?: (index: number) => void;
}

function Dot({ up }: { up: boolean }) {
  return <span className={`dot ${up ? 'up' : 'down'}`} aria-label={up ? 'up' : 'down'} />;
}

/** "Check everything": a live view of the selected device's ports, like hovering in Packet Tracer. */
export function Inspector({ net, selection, onClose, onOpen, onDeleteDevice, onDeleteLink }: Props) {
  if (!selection) return null;

  if (selection.kind === 'link') {
    const l = net.topology.links[selection.index];
    if (!l) return null;
    const name = (id: string) => net.device(id).running.hostname;
    return (
      <div className="inspector panel">
        <div className="inspector-head">
          <Cable size={18} />
          <div>
            <strong>Cable</strong>
            <div className="mono muted small">Copper straight-through</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <table className="ports">
          <tbody>
            {[l.a, l.b].map((e) => (
              <tr key={e.device}>
                <td>
                  <Dot up={net.linkUp(e.device, e.port)} />
                </td>
                <td>{name(e.device)}</td>
                <td className="mono">{e.port}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {onDeleteLink && (
          <div className="inspector-actions">
            <button className="btn danger small" onClick={() => onDeleteLink(selection.index)}>
              <Trash2 size={14} /> Remove cable
            </button>
          </div>
        )}
      </div>
    );
  }

  const dev = net.devices.get(selection.id);
  if (!dev) return null;
  const cfg = dev.running;
  const endpoint = isEndpoint(dev.kind);

  return (
    <div className="inspector panel">
      <div className="inspector-head">
        <DeviceGlyph kind={dev.kind} size={30} />
        <div>
          <strong>{cfg.hostname}</strong>
          <div className="mono muted small">
            {modelInfo(dev.spec).label} · {dev.id}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {endpoint ? (
        <dl className="facts">
          <dt>Link</dt>
          <dd>
            <Dot up={net.linkUp(dev.id, 'FastEthernet0')} /> Fa0
            {net.peer(dev.id, 'FastEthernet0') &&
              ` → ${net.device(net.peer(dev.id, 'FastEthernet0')!.device).running.hostname}`}
          </dd>
          <dt>IPv4</dt>
          <dd className="mono">{cfg.pc?.ip ?? 'not set'}</dd>
          <dt>Mask</dt>
          <dd className="mono">{cfg.pc?.mask ?? 'not set'}</dd>
          <dt>Gateway</dt>
          <dd className="mono">{cfg.pc?.gateway ?? 'not set'}</dd>
        </dl>
      ) : (
        <div className="ports-wrap">
          <table className="ports">
            <thead>
              <tr>
                <th />
                <th>Port</th>
                {dev.kind !== 'hub' && <th>{dev.kind === 'switch' ? 'VLAN' : 'IP address'}</th>}
                <th>Connected to</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(cfg.interfaces)
                // Routers have few ports, so show all; switches and hubs only show cabled ports.
                .filter((i) => dev.kind === 'router' || !!net.peer(dev.id, i.name))
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                .map((i) => {
                  const peer = net.peer(dev.id, i.name.split('.')[0]!);
                  return (
                    <tr key={i.name} className={i.shutdown ? 'shut' : undefined}>
                      <td>
                        <Dot up={net.ifaceUp(dev.id, i.name)} />
                      </td>
                      <td className="mono">{shortName(i.name)}</td>
                      {dev.kind !== 'hub' && (
                        <td className="mono">
                          {dev.kind === 'switch'
                            ? i.mode === 'trunk'
                              ? 'trunk'
                              : (i.accessVlan ?? 1)
                            : i.ip
                              ? `${i.ip.address}${i.encapsulationVlan ? ` (VLAN ${i.encapsulationVlan})` : ''}`
                              : i.shutdown
                                ? 'shut down'
                                : '—'}
                        </td>
                      )}
                      <td className="muted">
                        {i.name.includes('.') ? 'subinterface' : peer ? net.device(peer.device).running.hostname : ''}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {dev.kind !== 'router' && (
            <p className="muted small">
              Cabled ports only · {dev.ports.length} ports total
            </p>
          )}
        </div>
      )}

      {(dev.kind !== 'hub' || onDeleteDevice) && (
        <div className="inspector-actions">
          {dev.kind !== 'hub' && (
            <button className="btn primary small" onClick={() => onOpen(dev.id)}>
              {endpoint ? <Monitor size={14} /> : <SquareTerminal size={14} />}
              {endpoint ? (dev.kind === 'printer' ? 'Open settings' : 'Open desktop') : 'Open console'}
            </button>
          )}
          {onDeleteDevice && (
            <button className="btn danger small" onClick={() => onDeleteDevice(dev.id)}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
