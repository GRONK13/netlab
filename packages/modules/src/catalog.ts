import { deviceSecurity } from './content/device-security.ts';
import { interVlanRouting } from './content/inter-vlan-routing.ts';
import { ipAddressing } from './content/ip-addressing.ts';
import { switchingVlans } from './content/switching-vlans.ts';
import type { Module } from './types.ts';

/** Modules in the order students should take them. */
export const MODULES: Module[] = [ipAddressing, switchingVlans, interVlanRouting, deviceSecurity];

export function getModule(id: string): Module | undefined {
  return MODULES.find((m) => m.id === id);
}
