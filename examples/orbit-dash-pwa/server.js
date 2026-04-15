const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const port = process.env.PORT || 4173;
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

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = buildCrcTable();
const iconCache = new Map();

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
    <string>Orbit Dash iPhone Certificate</string>
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
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const png = Buffer.concat([
    pngSignature,
    createChunk("IHDR", header),
    createChunk("IDAT", zlib.deflateSync(raw)),
    createChunk("IEND", Buffer.alloc(0)),
  ]);

  iconCache.set(size, png);
  return png;
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
    res.writeHead(403);
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
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });
    res.end(data);
  });
}

const hasHttpsCert = fs.existsSync(keyPath) && fs.existsSync(certPath);

const server = hasHttpsCert
  ? https.createServer(
      {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
      handleRequest,
    )
  : http.createServer(handleRequest);

server.listen(port, () => {
  const interfaces = os.networkInterfaces();
  const lanUrls = [];
  const protocol = hasHttpsCert ? "https" : "http";

  for (const addresses of Object.values(interfaces)) {
    if (!addresses) {
      continue;
    }
    for (const address of addresses) {
      if (address.family === "IPv4" && !address.internal) {
        lanUrls.push(`${protocol}://${address.address}:${port}`);
      }
    }
  }

  console.log(`Orbit Dash running at ${protocol}://localhost:${port}`);
  for (const url of lanUrls) {
    console.log(`LAN access: ${url}`);
  }

  if (hasHttpsCert) {
    console.log(`TLS certificate: ${certPath}`);
    console.log(`Root CA for trust: ${rootCaPath}`);
    console.log("If Safari still warns, install and trust certs/root-ca-cert.cer on the device.");
  } else {
    console.log("HTTPS disabled: generate certs with powershell -ExecutionPolicy Bypass -File .\\scripts\\generate-cert.ps1");
  }
});
