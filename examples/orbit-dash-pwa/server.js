const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { spawnSync } = require("child_process");

const preferredHttpsPort = Number(process.env.PORT || 4173);
const preferredHttpPort = Number(process.env.HTTP_PORT || 4174);
const root = __dirname;
const certDir = path.join(root, "certs");
const rootCaPath = path.join(certDir, "root-ca-cert.cer");
const keyPath = path.join(certDir, "local-key.pem");
const certPath = path.join(certDir, "local-cert.pem");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function getCacheControl(ext, requestPath) {
  if ([".html", ".js", ".css", ".json"].includes(ext) || requestPath === "/sw.js") {
    return "no-store";
  }
  return "public, max-age=3600";
}

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = buildCrcTable();
const iconCache = new Map();

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function createMobileConfig(host) {
  const certificateData = fs.readFileSync(rootCaPath).toString("base64");
  const profileUuid = crypto.randomUUID().toUpperCase();
  const payloadUuid = crypto.randomUUID().toUpperCase();
  const safeHost = escapeXml(host || "localhost");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>PayloadContent</key>
    <array>
      <dict>
        <key>PayloadCertificateFileName</key>
        <string>OrbitDashRootCA.cer</string>
        <key>PayloadContent</key>
        <data>${certificateData}</data>
        <key>PayloadDescription</key>
        <string>Installs the Orbit Dash local development root certificate.</string>
        <key>PayloadDisplayName</key>
        <string>Orbit Dash Local Root CA</string>
        <key>PayloadIdentifier</key>
        <string>com.orbitdash.root.${payloadUuid}</string>
        <key>PayloadType</key>
        <string>com.apple.security.root</string>
        <key>PayloadUUID</key>
        <string>${payloadUuid}</string>
        <key>PayloadVersion</key>
        <integer>1</integer>
      </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Installs the Orbit Dash local root certificate for ${safeHost}. After installation, enable full trust in Settings.</string>
    <key>PayloadDisplayName</key>
    <string>Orbit Dash iOS Certificate</string>
    <key>PayloadIdentifier</key>
    <string>com.orbitdash.profile.${profileUuid}</string>
    <key>PayloadOrganization</key>
    <string>Orbit Dash</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${profileUuid}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
  </dict>
</plist>`;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function mix(a, b, ratio) {
  return Math.round(a + (b - a) * ratio);
}

function fillCircle(pixelData, size, cx, cy, radius, color) {
  const radiusSquared = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radiusSquared) {
        const offset = (y * size + x) * 4;
        pixelData[offset] = color[0];
        pixelData[offset + 1] = color[1];
        pixelData[offset + 2] = color[2];
        pixelData[offset + 3] = color[3];
      }
    }
  }
}

function fillRing(pixelData, size, cx, cy, radius, thickness, color) {
  const outer = radius * radius;
  const inner = (radius - thickness) * (radius - thickness);
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= outer && distanceSquared >= inner) {
        const offset = (y * size + x) * 4;
        pixelData[offset] = color[0];
        pixelData[offset + 1] = color[1];
        pixelData[offset + 2] = color[2];
        pixelData[offset + 3] = color[3];
      }
    }
  }
}

function fillRotatedRect(pixelData, size, cx, cy, width, height, angle, color) {
  const halfW = width / 2;
  const halfH = height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const radius = Math.ceil(Math.sqrt(halfW * halfW + halfH * halfH));
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const localX = (x - cx) * cos + (y - cy) * sin;
      const localY = -(x - cx) * sin + (y - cy) * cos;
      if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
        const offset = (y * size + x) * 4;
        pixelData[offset] = color[0];
        pixelData[offset + 1] = color[1];
        pixelData[offset + 2] = color[2];
        pixelData[offset + 3] = color[3];
      }
    }
  }
}

function createIconPng(size) {
  if (iconCache.has(size)) {
    return iconCache.get(size);
  }
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const vertical = y / (size - 1);
      const diagonal = (x + y) / (2 * (size - 1));
      pixels[offset] = mix(11, 20, vertical * 0.35);
      pixels[offset + 1] = mix(16, 28, diagonal * 0.6);
      pixels[offset + 2] = mix(32, 60, vertical * 0.8);
      pixels[offset + 3] = 255;
    }
  }
  const center = size / 2;
  fillRing(pixels, size, center, center, size * 0.33, size * 0.03, [124, 155, 255, 255]);
  fillCircle(pixels, size, center, center, size * 0.09, [157, 255, 218, 255]);
  fillCircle(pixels, size, size * 0.66, size * 0.39, size * 0.07, [157, 255, 218, 255]);
  fillRotatedRect(pixels, size, size * 0.36, size * 0.62, size * 0.12, size * 0.12, -0.35, [255, 102, 136, 255]);
  fillRotatedRect(pixels, size, size * 0.59, size * 0.71, size * 0.1, size * 0.1, 0.28, [255, 102, 136, 225]);

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    pngSignature,
    createChunk("IHDR", header),
    createChunk("IDAT", zlib.deflateSync(raw)),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
  iconCache.set(size, png);
  return png;
}

function getAltNames() {
  const names = new Set(["localhost", os.hostname()]);
  const ipAddresses = ["127.0.0.1"];
  for (const addresses of Object.values(os.networkInterfaces())) {
    if (!addresses) continue;
    for (const address of addresses) {
      if (address.family === "IPv4" && !address.internal && !address.address.startsWith("169.254.")) {
        ipAddresses.push(address.address);
      }
    }
  }
  return {
    dns: [...names].filter(Boolean),
    ips: [...new Set(ipAddresses)],
  };
}

function ensureCertificateDirectory() {
  fs.mkdirSync(certDir, { recursive: true });
}

function writeOpenSslConfigs() {
  const { dns, ips } = getAltNames();
  const rootConfigPath = path.join(certDir, "openssl-root.cnf");
  const serverConfigPath = path.join(certDir, "openssl-local.cnf");
  const serverExtPath = path.join(certDir, "openssl-local.ext");
  const altNames = [];
  dns.forEach((name, index) => altNames.push(`DNS.${index + 1} = ${name}`));
  ips.forEach((ip, index) => altNames.push(`IP.${index + 1} = ${ip}`));

  fs.writeFileSync(rootConfigPath, `[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_ca

[dn]
CN = Orbit Dash Local Root CA
O = Orbit Dash

[v3_ca]
basicConstraints = critical, CA:true
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
`, "ascii");
  fs.writeFileSync(serverConfigPath, `[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[dn]
CN = Orbit Dash Local Dev
O = Orbit Dash
`, "ascii");
  fs.writeFileSync(serverExtPath, `[v3_req]
subjectAltName = @alt_names
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
basicConstraints = critical, CA:FALSE

[alt_names]
${altNames.join("\n")}
`, "ascii");

  return { rootConfigPath, serverConfigPath, serverExtPath };
}

function runOpenSsl(args, description) {
  const result = spawnSync("openssl", args, { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${description} failed: ${result.stderr || result.stdout || "unknown error"}`);
  }
}

function ensureLocalCertificates() {
  if (fs.existsSync(keyPath) && fs.existsSync(certPath) && fs.existsSync(rootCaPath)) {
    return true;
  }

  try {
    ensureCertificateDirectory();
    const { rootConfigPath, serverConfigPath, serverExtPath } = writeOpenSslConfigs();
    const rootKeyPath = path.join(certDir, "root-ca-key.pem");
    const rootCertPemPath = path.join(certDir, "root-ca-cert.pem");
    const localCerPath = path.join(certDir, "local-cert.cer");
    const csrPath = path.join(certDir, "local-cert.csr");

    runOpenSsl(["req", "-x509", "-nodes", "-newkey", "rsa:2048", "-keyout", rootKeyPath, "-out", rootCertPemPath, "-days", "3650", "-config", rootConfigPath, "-extensions", "v3_ca"], "root certificate generation");
    runOpenSsl(["x509", "-in", rootCertPemPath, "-outform", "der", "-out", rootCaPath], "root certificate export");
    runOpenSsl(["req", "-nodes", "-newkey", "rsa:2048", "-keyout", keyPath, "-out", csrPath, "-config", serverConfigPath], "site csr generation");
    runOpenSsl(["x509", "-req", "-in", csrPath, "-CA", rootCertPemPath, "-CAkey", rootKeyPath, "-CAcreateserial", "-out", certPath, "-days", "825", "-sha256", "-extfile", serverExtPath, "-extensions", "v3_req"], "site certificate signing");
    runOpenSsl(["x509", "-in", certPath, "-outform", "der", "-out", localCerPath], "site certificate export");
    return true;
  } catch (error) {
    console.warn("HTTPS certificate auto-generation failed.");
    console.warn(String(error.message || error));
    return false;
  }
}

function handleRequest(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];

  if (requestPath === "/root-ca-cert.cer") {
    if (!fs.existsSync(rootCaPath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/pkix-cert",
      "Content-Disposition": 'attachment; filename="root-ca-cert.cer"',
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(rootCaPath).pipe(res);
    return;
  }

  if (requestPath === "/ios-root-ca.mobileconfig") {
    if (!fs.existsSync(rootCaPath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const mobileConfig = createMobileConfig(req.headers.host);
    res.writeHead(200, {
      "Content-Type": "application/x-apple-aspen-config; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orbit-dash-root.mobileconfig"',
      "Cache-Control": "no-cache",
    });
    res.end(mobileConfig);
    return;
  }

  if (requestPath === "/icons/icon-192.png" || requestPath === "/icons/icon-512.png") {
    const size = requestPath.includes("512") ? 512 : 192;
    const png = createIconPng(size);
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    });
    res.end(png);
    return;
  }

  const decodedPath = decodeURIComponent(requestPath);
  const safePath = path.normalize(decodedPath).replace(/^[/\\]+/, "");
  if (safePath === "certs" || safePath.startsWith(`certs${path.sep}`) || safePath === "scripts" || safePath.startsWith(`scripts${path.sep}`)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  const filePath = path.join(root, safePath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": getCacheControl(ext, requestPath),
    });
    res.end(data);
  });
}

function getLanHosts() {
  const hosts = [];
  for (const addresses of Object.values(os.networkInterfaces())) {
    if (!addresses) continue;
    for (const address of addresses) {
      if (address.family === "IPv4" && !address.internal) {
        hosts.push(address.address);
      }
    }
  }
  return [...new Set(hosts)];
}

function listenWithFallback(server, preferredPort, label, maxAttempts = 20) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let currentPort = preferredPort;

    const tryListen = () => {
      attempts += 1;
      server.once("error", onError);
      server.listen(currentPort, () => {
        server.removeListener("error", onError);
        resolve(currentPort);
      });
    };

    const onError = (error) => {
      server.removeListener("error", onError);
      if (error.code === "EADDRINUSE" && attempts < maxAttempts) {
        currentPort += 1;
        setImmediate(tryListen);
        return;
      }

      reject(new Error(`${label} failed to bind after ${attempts} attempt(s): ${error.message}`));
    };

    tryListen();
  });
}

function printAccessUrls(protocol, port, label) {
  console.log(`${label}: ${protocol}://localhost:${port}`);
  for (const host of getLanHosts()) {
    console.log(`${label}: ${protocol}://${host}:${port}`);
  }
}

const hasHttpsCert = ensureLocalCertificates() && fs.existsSync(keyPath) && fs.existsSync(certPath);

const mainServer = hasHttpsCert
  ? https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, handleRequest)
  : http.createServer(handleRequest);

async function start() {
  const protocol = hasHttpsCert ? "https" : "http";
  const mainPort = await listenWithFallback(mainServer, preferredHttpsPort, `${protocol.toUpperCase()} server`);

  console.log(`Orbit Dash main server ready.`);
  printAccessUrls(protocol, mainPort, protocol.toUpperCase());

  if (!hasHttpsCert) {
    console.log("HTTPS unavailable, falling back to HTTP only.");
    return;
  }

  console.log(`TLS certificate: ${certPath}`);
  console.log(`Root CA for trust: ${rootCaPath}`);

  let helperPort = preferredHttpPort === mainPort ? mainPort + 1 : preferredHttpPort;
  const helperServer = http.createServer((req, res) => {
    const hostHeader = req.headers.host || `localhost:${helperPort}`;
    const host = hostHeader.replace(/:\d+$/, "");
    res.writeHead(302, { Location: `https://${host}:${mainPort}${req.url || "/"}` });
    res.end();
  });

  helperPort = await listenWithFallback(helperServer, helperPort, "HTTP redirect helper");
  printAccessUrls("http", helperPort, "HTTP helper");

  if (mainPort !== preferredHttpsPort || helperPort !== preferredHttpPort) {
    console.log(`Port adjustment: preferred HTTPS ${preferredHttpsPort}, actual HTTPS ${mainPort}; preferred HTTP ${preferredHttpPort}, actual HTTP ${helperPort}.`);
  }
}

start().catch((error) => {
  console.error(String(error.message || error));
  process.exitCode = 1;
});
