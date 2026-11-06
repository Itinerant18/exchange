/**
 * GoDaddy Domain & Nameserver Automation Script for Exchnage
 *
 * Usage:
 *   node scripts/godaddy-setup.js check [domain]
 *   node scripts/godaddy-setup.js set-nameservers [domain] [ns1] [ns2]
 *
 * Environment variables:
 *   GODADDY_API_KEY
 *   GODADDY_API_SECRET
 */

const https = require('node:https');

const DOMAIN = process.argv[3] || 'exchange24.site';
const API_KEY = process.env.GODADDY_API_KEY;
const API_SECRET = process.env.GODADDY_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('\nError: Missing GoDaddy credentials.');
  console.error('Please set GODADDY_API_KEY and GODADDY_API_SECRET environment variables.');
  console.error('Generate Production API keys at: https://developer.godaddy.com/keys\n');
  process.exit(1);
}

const authHeader = `sso-key ${API_KEY.trim()}:${API_SECRET.trim()}`;

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          if (data) parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ statusCode: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function checkDomain() {
  console.log(`Checking domain status for ${DOMAIN}...`);
  const res = await request({
    hostname: 'api.godaddy.com',
    path: `/v1/domains/${DOMAIN}`,
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  if (res.statusCode === 200) {
    console.log('\n--- Domain Information ---');
    console.log(`Domain: ${res.data.domain}`);
    console.log(`Status: ${res.data.status}`);
    console.log(`Locked: ${res.data.locked}`);
    console.log(`Nameservers: ${JSON.stringify(res.data.nameServers, null, 2)}`);
    console.log(`Expires: ${res.data.expires}`);
  } else {
    console.error(`\nFailed with status ${res.statusCode}:`, res.data);
  }
}

async function setNameservers(ns1, ns2) {
  if (!ns1 || !ns2) {
    console.error('Error: Please provide two Cloudflare nameservers.');
    console.error('Usage: node scripts/godaddy-setup.js set-nameservers exchange24.site <ns1> <ns2>');
    process.exit(1);
  }

  console.log(`Updating nameservers for ${DOMAIN} to: [${ns1}, ${ns2}]...`);
  const res = await request(
    {
      hostname: 'api.godaddy.com',
      path: `/v1/domains/${DOMAIN}`,
      method: 'PATCH',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    },
    { nameServers: [ns1.trim(), ns2.trim()] },
  );

  if (res.statusCode === 204 || res.statusCode === 200) {
    console.log('\nSuccess! Nameservers updated successfully in GoDaddy.');
    console.log('DNS propagation to Cloudflare typically completes within 5-30 minutes.');
  } else {
    console.error(`\nFailed to update nameservers (HTTP ${res.statusCode}):`, res.data);
  }
}

const command = process.argv[2] || 'check';
if (command === 'check') {
  checkDomain().catch(console.error);
} else if (command === 'set-nameservers') {
  setNameservers(process.argv[4], process.argv[5]).catch(console.error);
} else {
  console.log('Unknown command. Available commands: check, set-nameservers');
}
