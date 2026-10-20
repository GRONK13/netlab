// Command prompt for end devices (PC, laptop, server, printer), modelled on the
// Windows commands students meet in Packet Tracer and in real life.

import type { Ctx } from './network.ts';
import { CommandTree } from './parser.ts';
import { pcPingOutput, tracertOutput } from './ping.ts';
import { macFor } from './show.ts';

export const PC_PROMPT = 'C:\\>';

const H = {
  ipconfig: 'Display or set IP configuration',
  '/all': 'Display full configuration information',
  ping: 'Send ICMP echo requests',
  '-n': 'Number of echo requests to send',
  tracert: 'Trace the route to a destination',
  arp: 'Display or clear the ARP cache',
  '-a': 'Display ARP entries',
  '-d': 'Delete all ARP entries',
  hostname: 'Display the host name',
  cls: 'Clear the screen',
  help: 'List available commands',
};

function ipconfig({ dev }: Ctx): string {
  const pc = dev.running.pc ?? {};
  return [
    '',
    'FastEthernet0 Connection:(default port)',
    '',
    '   Connection-specific DNS Suffix..: ',
    `   IPv4 Address....................: ${pc.ip ?? '0.0.0.0'}`,
    `   Subnet Mask.....................: ${pc.mask ?? '0.0.0.0'}`,
    `   Default Gateway.................: ${pc.gateway ?? '0.0.0.0'}`,
    '',
  ].join('\n');
}

function ipconfigAll({ net, dev }: Ctx): string {
  const pc = dev.running.pc ?? {};
  const up = net.linkUp(dev.id, 'FastEthernet0');
  return [
    '',
    `   Host Name.......................: ${dev.running.hostname}`,
    '',
    'FastEthernet0 Connection:(default port)',
    '',
    `   Media State.....................: ${up ? 'Connected' : 'Media disconnected'}`,
    '   Connection-specific DNS Suffix..: ',
    `   Physical Address................: ${macFor(dev.id).toUpperCase()}`,
    '   DHCP Enabled....................: No',
    `   IPv4 Address....................: ${pc.ip ?? '0.0.0.0'}`,
    `   Subnet Mask.....................: ${pc.mask ?? '0.0.0.0'}`,
    `   Default Gateway.................: ${pc.gateway ?? '0.0.0.0'}`,
    '   DNS Servers.....................: 0.0.0.0',
    '',
  ].join('\n');
}

function setIp(ctx: Ctx, a: Record<string, string>): string {
  ctx.dev.running.pc = { ip: a.ip, mask: a.mask, gateway: a.gateway };
  ctx.dev.arp.clear();
  return ipconfig(ctx);
}

function arpTable({ dev }: Ctx): string {
  if (dev.arp.size === 0) return 'No ARP Entries Found';
  const rows = [...dev.arp.entries()].map(
    ([ip, mac]) => `  ${ip.padEnd(22)}${mac.padEnd(22)}dynamic`,
  );
  return ['  Internet Address      Physical Address      Type', ...rows].join('\n');
}

export const pcTree = new CommandTree<Ctx>(H)
  .add('ipconfig', {}, ipconfig)
  .add('ipconfig /all', {}, ipconfigAll)
  .add('ipconfig <ip:ip> <mask:mask>', { ip: 'IP address', mask: 'Subnet mask' }, setIp)
  .add('ipconfig <ip:ip> <mask:mask> <gateway:ip>', { gateway: 'Default gateway' }, setIp)
  .add('ping <target:ip>', { target: 'Destination IP address' }, ({ net, dev }, a) =>
    pcPingOutput(net, dev.id, a.target!),
  )
  .add('ping -n <count:length> <target:ip>', { count: 'Number of echo requests (1-100)' }, ({ net, dev }, a) => {
    const n = Number(a.count);
    if (n < 1 || n > 100) return 'Bad value for option -n, valid range is from 1 to 100.';
    return pcPingOutput(net, dev.id, a.target!, n);
  })
  .add('tracert <target:ip>', { target: 'Destination IP address' }, ({ net, dev }, a) =>
    tracertOutput(net, dev.id, a.target!),
  )
  .add('arp -a', {}, arpTable)
  .add('arp -d', {}, ({ dev }) => {
    dev.arp.clear();
  })
  .add('hostname', {}, ({ dev }) => dev.running.hostname)
  // Clear screen and scrollback; the terminal interprets these escape codes.
  .add('cls', {}, () => '\x1b[2J\x1b[3J\x1b[H')
  .add('help', {}, () =>
    [
      'Available commands:',
      '  arp -a                         Show the ARP cache',
      '  arp -d                         Clear the ARP cache',
      '  cls                            Clear the screen',
      '  hostname                       Show this computer\'s name',
      '  ipconfig [/all]                Show IP settings',
      '  ipconfig <ip> <mask> [gateway] Set IP settings',
      '  ping [-n count] <ip>           Test reachability',
      '  tracert <ip>                   Show the route to a host',
    ].join('\n'),
  );
