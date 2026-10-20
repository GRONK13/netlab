import { describe, expect, it } from 'vitest';
import {
  inSubnet,
  intToIp,
  ipToInt,
  maskToPrefix,
  parseCidr,
  prefixForHosts,
  prefixToMask,
  subnetOf,
} from '../src/ipv4.ts';

describe('masks and prefixes', () => {
  it('converts every prefix to a mask and back', () => {
    const masks = [
      '0.0.0.0',
      '128.0.0.0',
      '192.0.0.0',
      '224.0.0.0',
      '240.0.0.0',
      '248.0.0.0',
      '252.0.0.0',
      '254.0.0.0',
      '255.0.0.0',
      '255.128.0.0',
      '255.192.0.0',
      '255.224.0.0',
      '255.240.0.0',
      '255.248.0.0',
      '255.252.0.0',
      '255.254.0.0',
      '255.255.0.0',
      '255.255.128.0',
      '255.255.192.0',
      '255.255.224.0',
      '255.255.240.0',
      '255.255.248.0',
      '255.255.252.0',
      '255.255.254.0',
      '255.255.255.0',
      '255.255.255.128',
      '255.255.255.192',
      '255.255.255.224',
      '255.255.255.240',
      '255.255.255.248',
      '255.255.255.252',
      '255.255.255.254',
      '255.255.255.255',
    ];
    masks.forEach((mask, prefix) => {
      expect(prefixToMask(prefix)).toBe(mask);
      expect(maskToPrefix(mask)).toBe(prefix);
    });
  });

  it('rejects masks with gaps', () => {
    expect(maskToPrefix('255.0.255.0')).toBeNull();
    expect(maskToPrefix('255.255.255.1')).toBeNull();
    expect(maskToPrefix('300.0.0.0')).toBeNull();
  });

  it('round-trips addresses through integers', () => {
    for (const ip of ['0.0.0.0', '10.0.0.1', '172.16.45.200', '192.168.1.255', '255.255.255.255']) {
      expect(intToIp(ipToInt(ip))).toBe(ip);
    }
  });

  it('parses CIDR notation', () => {
    expect(parseCidr('192.168.1.0/24')).toEqual({ ip: '192.168.1.0', prefix: 24 });
    expect(parseCidr(' 10.0.0.0/8 ')).toEqual({ ip: '10.0.0.0', prefix: 8 });
    expect(parseCidr('10.0.0.0/33')).toBeNull();
    expect(parseCidr('10.0.0/8')).toBeNull();
    expect(parseCidr('256.0.0.0/8')).toBeNull();
  });
});

describe('subnets', () => {
  it('works out textbook examples', () => {
    expect(subnetOf('192.168.1.130', 26)).toEqual({
      network: '192.168.1.128',
      broadcast: '192.168.1.191',
      prefix: 26,
      mask: '255.255.255.192',
      first: '192.168.1.129',
      last: '192.168.1.190',
      hosts: 62,
    });
    expect(subnetOf('172.16.45.200', 20)).toMatchObject({
      network: '172.16.32.0',
      broadcast: '172.16.47.255',
      first: '172.16.32.1',
      last: '172.16.47.254',
      hosts: 4094,
    });
    expect(subnetOf('10.1.2.3', 8)).toMatchObject({
      network: '10.0.0.0',
      broadcast: '10.255.255.255',
      hosts: 16777214,
    });
    expect(subnetOf('192.168.50.77', 30)).toMatchObject({
      network: '192.168.50.76',
      broadcast: '192.168.50.79',
      hosts: 2,
    });
  });

  it('handles /31, /32 and /0', () => {
    expect(subnetOf('10.0.0.5', 31)).toMatchObject({
      network: '10.0.0.4',
      first: '10.0.0.4',
      last: '10.0.0.5',
      hosts: 2,
    });
    expect(subnetOf('10.0.0.5', 32)).toMatchObject({
      network: '10.0.0.5',
      first: '10.0.0.5',
      last: '10.0.0.5',
      hosts: 1,
    });
    expect(subnetOf('8.8.8.8', 0)).toMatchObject({
      network: '0.0.0.0',
      broadcast: '255.255.255.255',
    });
  });

  it('tells whether an address is in a subnet', () => {
    expect(inSubnet('192.168.1.100', '192.168.1.0', 25)).toBe(true);
    expect(inSubnet('192.168.1.200', '192.168.1.0', 25)).toBe(false);
    expect(inSubnet('172.16.47.1', '172.16.32.0', 20)).toBe(true);
    expect(inSubnet('172.16.48.1', '172.16.32.0', 20)).toBe(false);
  });

  it('finds the smallest subnet for a host count', () => {
    expect(prefixForHosts(1)).toBe(30);
    expect(prefixForHosts(2)).toBe(30);
    expect(prefixForHosts(3)).toBe(29);
    expect(prefixForHosts(50)).toBe(26);
    expect(prefixForHosts(62)).toBe(26);
    expect(prefixForHosts(63)).toBe(25);
    expect(prefixForHosts(254)).toBe(24);
    expect(prefixForHosts(255)).toBe(23);
    expect(prefixForHosts(1000)).toBe(22);
  });
});
