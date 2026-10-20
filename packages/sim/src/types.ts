export type DeviceKind = 'switch' | 'router' | 'pc';

export type SwitchportMode = 'access' | 'trunk';

/** A VLAN list on a trunk: either every VLAN, or an explicit sorted list. */
export type VlanSet = 'all' | number[];

export interface InterfaceConfig {
  /** Canonical full name, e.g. "FastEthernet0/1" or "GigabitEthernet0/0.10". */
  name: string;
  shutdown: boolean;
  description?: string;
  // Switch ports
  mode?: SwitchportMode;
  /** `switchport mode` was typed explicitly (shown in running-config). */
  modeConfigured?: boolean;
  accessVlan?: number;
  trunkAllowed?: VlanSet;
  // Router interfaces and subinterfaces
  ip?: { address: string; mask: string };
  /** dot1Q VLAN for a router subinterface. */
  encapsulationVlan?: number;
}

export interface LineConfig {
  password?: string;
  login: boolean;
}

export interface PcConfig {
  ip?: string;
  mask?: string;
  gateway?: string;
}

export interface DeviceConfig {
  hostname: string;
  enableSecret?: string;
  enablePassword?: string;
  servicePasswordEncryption: boolean;
  bannerMotd?: string;
  con: LineConfig;
  /** vty 0..15 */
  vty: LineConfig[];
  vlans: Record<string, { name: string }>;
  interfaces: Record<string, InterfaceConfig>;
  pc?: PcConfig;
}

export interface DeviceSpec {
  id: string;
  kind: DeviceKind;
  /** Hardware model shown to students, e.g. "2960-24TT", "2911", "PC". */
  model?: string;
  /** Position on the topology canvas (0..100 percent). */
  x: number;
  y: number;
  hostname?: string;
  pc?: PcConfig;
}

export interface LinkEnd {
  device: string;
  port: string;
}

export interface LinkSpec {
  a: LinkEnd;
  b: LinkEnd;
}

export interface TopologySpec {
  devices: DeviceSpec[];
  links: LinkSpec[];
  /** Commands applied silently when the lab loads (not part of the student's log). */
  setup?: Record<string, string[]>;
}

export interface LogEntry {
  device: string;
  line: string;
}
