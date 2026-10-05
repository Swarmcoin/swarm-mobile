#!/usr/bin/env python3
"""Lists the remote TCP endpoints one app reached, from sampled /proc/net/tcp.

Usage: swarm_remote_hosts.py <samples file> <app uid> <allowed host:port> [...]

The samples file holds repeated copies of /proc/net/tcp and /proc/net/tcp6
from the device, each copy after a line "# <unix time>". Every endpoint the
app's uid held outside loopback is printed with the samples it was seen in
and the name it resolves to. Exits 0 when the app reached an allowed host and
port and nothing else, 1 when it reached anything else, and 2 when the
samples show no connection of the app at all.
"""

import ipaddress
import socket
import sys

# Named when they appear, so a stray connection says what it is.
WATCHED = [
    "lwd-main.swarm.green",
    "lwd.swarm.green",
    "wallet.swarm.green",
    "mainnet.explore.swarm.green",
    "testnet.explore.swarm.green",
    "explore.swarm.green",
    "swarm.green",
    "www.swarm.green",
    "validator.nymtech.net",
    "nymtech.net",
    "nym-api.nymtech.net",
    "cloudflare-dns.com",
    "dns.google",
    "zec.rocks",
    "na.zec.rocks",
    "eu.zec.rocks",
    "sa.zec.rocks",
    "ap.zec.rocks",
    "testnet.zec.rocks",
    "hosh.zec.rocks",
    "gateway2.petroff-staking.space",
    "clients3.google.com",
]

LISTEN = "0A"


def addresses(host):
    try:
        return {info[4][0] for info in socket.getaddrinfo(host, None)}
    except OSError:
        return set()


def endpoint(field):
    hex_ip, hex_port = field.split(":")
    raw = bytes.fromhex(hex_ip)
    if len(raw) == 4:
        ip = ipaddress.IPv4Address(raw[::-1])
    else:
        ip = ipaddress.IPv6Address(b"".join(raw[i : i + 4][::-1] for i in range(0, 16, 4)))
        ip = ip.ipv4_mapped or ip
    return ip, int(hex_port, 16)


def name_of(ip, names):
    known = sorted(names.get(ip, set()))
    if known:
        return ", ".join(known)
    try:
        return socket.gethostbyaddr(ip)[0] + " (reverse DNS)"
    except OSError:
        return "unresolved"


def main():
    samples_path, uid = sys.argv[1], sys.argv[2]
    allowed_targets = [target.rsplit(":", 1) for target in sys.argv[3:]]
    allowed_hosts = [host for host, _ in allowed_targets]
    names = {}
    for host in WATCHED + allowed_hosts:
        for ip in addresses(host):
            names.setdefault(ip, set()).add(host)
    allowed = {
        (ip, int(port)) for host, port in allowed_targets for ip in addresses(host)
    }

    seen = {}
    samples = rows = 0
    stamp = ""
    for line in open(samples_path, encoding="utf-8", errors="replace"):
        if line.startswith("# "):
            stamp = line[2:].strip()
            samples += 1
            continue
        parts = line.split()
        if len(parts) < 8 or not parts[0].endswith(":"):
            continue
        rows += 1
        if parts[7] != uid or parts[3] == LISTEN:
            continue
        ip, port = endpoint(parts[2])
        if ip.is_unspecified or ip.is_loopback:
            continue
        entry = seen.setdefault((str(ip), port), {"first": stamp, "hits": 0})
        entry["last"] = stamp
        entry["hits"] += 1

    print(f"samples {samples}, socket rows {rows}, app uid {uid}, allowed {' '.join(sys.argv[3:])}")
    unexpected = 0
    for (ip, port), entry in sorted(seen.items()):
        verdict = "allowed" if (ip, port) in allowed else "UNEXPECTED"
        unexpected += verdict == "UNEXPECTED"
        print(
            f"{verdict} {ip}:{port} {name_of(ip, names)}, "
            f"seen {entry['first']}..{entry['last']} in {entry['hits']} samples"
        )
    if not seen:
        print("NOT PROVEN: no connection of the app appears in any sample")
        return 2
    return 1 if unexpected else 0


if __name__ == "__main__":
    sys.exit(main())
