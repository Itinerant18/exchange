# Cloudflare Zero Trust & Cloudflare Tunnel Architecture for Exchnage

This document outlines the architecture and deployment procedure for securing Exchnage internal tools, admin portals, and staging database environments using Cloudflare Zero Trust and `cloudflared` tunnels (included free for up to 50 users on Cloudflare's free tier).

---

## 1. Zero Trust Architecture Overview

Traditional architectures require opening inbound firewall ports (such as port 80, 443, or 5432) and running self-hosted VPNs. Cloudflare Tunnels (`cloudflared`) create lightweight, encrypted, outbound-only connections to Cloudflare's global edge network.

```
       ┌────────────────────────┐
       │   Exchnage Admin / Dev │
       └───────────┬────────────┘
                   │ HTTPS (Identity-authenticated via Okta / Google / Email OTP)
                   ▼
       ┌────────────────────────┐
       │ Cloudflare Edge (WAF)  │
       │ Zero Trust Access      │
       └───────────┬────────────┘
                   │ Encrypted WireGuard / QUIC Tunnel (Outbound only, 0 open inbound ports)
                   ▼
       ┌────────────────────────┐
       │ cloudflared daemon     │ (Runs on private VM, Docker, or dev laptop)
       └───────────┬────────────┘
                   │ Local TCP / HTTP loopback
                   ▼
       ┌────────────────────────┐
       │ Internal Admin Service │
       │ / Local Staging DB     │
       └────────────────────────┘
```

---

## 2. Cloudflare Tunnel Setup Guide

### Step 1: Install `cloudflared`
- On Windows (PowerShell):
  ```powershell
  winget install --id Cloudflare.cloudflared
  ```
- On Linux / macOS:
  ```bash
  curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  sudo dpkg -i cloudflared.deb
  ```

### Step 2: Authenticate `cloudflared` with the Exchnage Account
```bash
cloudflared tunnel login
```
This opens a browser window to select your zone and stores the tunnel certificate locally.

### Step 3: Create the Named Tunnel
```bash
cloudflared tunnel create exchnage-admin-tunnel
```
This generates a tunnel UUID and a credentials file at `~/.cloudflared/<TUNNEL_ID>.json`.

### Step 4: Configure the Ingress Rules (`~/.cloudflared/config.yml`)
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  # Internal Admin Operations Panel
  - hostname: admin.exchnage.internal.souvikmn55.com
    service: http://localhost:8080
  # Direct Private Postgres Proxy for Migrations & Staging
  - hostname: db.exchnage.internal.souvikmn55.com
    service: tcp://localhost:5432
  # Default catch-all rule (required)
  - service: http_status:404
```

### Step 5: Route DNS Traffic to the Tunnel
```bash
cloudflared tunnel route dns exchnage-admin-tunnel admin.exchnage.internal.souvikmn55.com
```

### Step 6: Run the Tunnel as a Background Service
```bash
# Test the tunnel interactively
cloudflared tunnel run exchnage-admin-tunnel

# Or install as a system daemon
sudo cloudflared service install
sudo systemctl start cloudflared
```

---

## 3. Configuring Zero Trust Access Policies

In the **Cloudflare One Dashboard** (`dash.zero-trust.com`):
1. Navigate to **Access** -> **Applications** -> **Add an application** -> **Self-hosted**.
2. **Application Configuration**:
   - Application Name: `Exchnage Admin Portal`
   - Application Domain: `admin.exchnage.internal.souvikmn55.com`
3. **Access Policies**:
   - Rule Name: `Curators & Engineers Only`
   - Action: `Allow`
   - Include: `Emails ending in @rentals.luxury` OR `souvikmn55@gmail.com`
   - Require MFA / One-Time PIN sent to email.
4. **Session Duration**: Set to 12 hours for admin sessions.

---

## 4. Security Hardening Checklist Summary

| Primitive | Protection Level | Status in Exchnage |
| :--- | :--- | :--- |
| **Cloudflare Turnstile** | CAPTCHA-free smart bot defense | Active on `/auth/login`, `/auth/register`, `/rentals/bookings` |
| **Cloudflare WAF / DDoS** | Unmetered Layer 3/4/7 mitigation | Active across all global edge POPs |
| **Cloudflare Universal SSL** | TLS 1.3 / Strict-Transport-Security | Active on `exchnage-souvik.souvikmn55.workers.dev` |
| **Cloudflare Tunnels** | Zero-inbound-port private routing | Architectural specification documented above |
| **Edge Rate Limiting** | Sliding window brute-force defense | Active in D1 SQLite (`edge_rate_limits`) |

