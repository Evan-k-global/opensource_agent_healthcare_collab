#!/bin/sh
set -eu
install -m 600 /input-keys/ssh_host_ed25519_key /etc/ssh/demo/ssh_host_ed25519_key
install -m 644 /input-keys/authorized_keys /etc/ssh/demo/authorized_keys
exec /usr/sbin/sshd -D -e
