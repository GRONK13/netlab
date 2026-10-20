// A tiny HTTP model: servers host one page; browsers on end devices fetch it if
// the network path works both ways. No DNS yet, so URLs must use an IP address.

import type { Network } from './network.ts';
import { isIp } from './parser.ts';
import { pingAndLearn } from './ping.ts';

export interface WebPage {
  title: string;
  body: string;
}

export type WebResponse =
  | { ok: true; url: string; host: string; page: WebPage }
  | { ok: false; url: string; error: string; detail: string };

export function defaultPage(hostname: string): WebPage {
  return {
    title: `Welcome to ${hostname}`,
    body: `This page is served by ${hostname}. If you can read it, routing, switching and IP settings all work between this browser and the server.`,
  };
}

export function browse(net: Network, fromId: string, rawUrl: string): WebResponse {
  const url = rawUrl.trim();
  const host = url.replace(/^https?:\/\//i, '').split(/[/:?#]/)[0] ?? '';
  if (!host) return { ok: false, url, error: 'Enter an address', detail: 'Type a server address, like http://192.168.1.10' };
  if (!isIp(host)) {
    return {
      ok: false,
      url,
      error: "This site can't be reached",
      detail: `${host}'s server IP address could not be found. There is no DNS server in this network yet, so use the server's IP address.`,
    };
  }
  const r = pingAndLearn(net, fromId, host);
  if (!r.success) {
    return { ok: false, url, error: 'Request Timeout', detail: r.reason ?? `${host} did not respond.` };
  }
  const target = r.hops[r.hops.length - 1];
  const dev = target ? net.devices.get(target.device) : undefined;
  if (!dev || dev.kind !== 'server') {
    return {
      ok: false,
      url,
      error: 'Connection refused',
      detail: `${host} answered, but no web server is running there. Web pages are hosted on Server devices.`,
    };
  }
  return { ok: true, url, host, page: dev.running.http ?? defaultPage(dev.running.hostname) };
}
