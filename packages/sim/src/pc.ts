import type { Ctx } from './network.ts';
import { CommandTree } from './parser.ts';
import { pcPingOutput } from './ping.ts';

export const PC_PROMPT = 'C:\\>';

const H = {
  ipconfig: 'Display or set IP configuration',
  ping: 'Send echo messages',
  help: 'List available commands',
};

function ipconfig({ dev }: Ctx): string {
  const pc = dev.running.pc ?? {};
  return [
    '',
    'FastEthernet0 Connection:(default port)',
    '',
    `   IPv4 Address....................: ${pc.ip ?? '0.0.0.0'}`,
    `   Subnet Mask.....................: ${pc.mask ?? '0.0.0.0'}`,
    `   Default Gateway.................: ${pc.gateway ?? '0.0.0.0'}`,
    '',
  ].join('\n');
}

function setIp(ctx: Ctx, a: Record<string, string>): string {
  ctx.dev.running.pc = { ip: a.ip, mask: a.mask, gateway: a.gateway };
  return ipconfig(ctx);
}

export const pcTree = new CommandTree<Ctx>(H)
  .add('ipconfig', {}, ipconfig)
  .add('ipconfig <ip:ip> <mask:mask>', { ip: 'IP address', mask: 'Subnet mask' }, setIp)
  .add('ipconfig <ip:ip> <mask:mask> <gateway:ip>', { gateway: 'Default gateway' }, setIp)
  .add('ping <target:ip>', { target: 'Destination IP address' }, ({ net, dev }, a) =>
    pcPingOutput(net, dev.id, a.target!),
  )
  .add('help', {}, () =>
    [
      'Available commands:',
      '  ipconfig                       Show IP settings',
      '  ipconfig <ip> <mask> [gateway] Set IP settings',
      '  ping <ip>                      Test reachability',
    ].join('\n'),
  );
