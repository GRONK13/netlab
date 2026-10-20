export { Network, Device, LIMITS, type Mode, type Session, type NetworkSnapshot } from './network.ts';
export { evaluate, evaluateAll, type Check } from './checks.ts';
export { ping, type PingResult } from './ping.ts';
export { shortName, physicalPorts } from './interfaces.ts';
export { macFor } from './show.ts';
export type {
  DeviceKind,
  DeviceSpec,
  LinkSpec,
  LinkEnd,
  TopologySpec,
  LogEntry,
  DeviceConfig,
  InterfaceConfig,
} from './types.ts';
