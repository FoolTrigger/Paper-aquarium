const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TEST_PORT = 8999;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function request(method, pathUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const req = http.request(url, {
      method,
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function rawRequest(rawString) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const client = net.createConnection({ port: TEST_PORT, host: '127.0.0.1' }, () => {
      client.write(rawString);
    });
    let data = '';
    client.on('data', chunk => { data += chunk.toString(); });
    client.on('end', () => resolve(data));
    client.on('error', reject);
  });
}

let serverProc = null;
let serverAlive = false;

function ensureServer() {
  if (serverAlive) return Promise.resolve();
  return new Promise((resolve) => {
    serverProc = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        AQUA_MAX_TANKS: '500',
        AQUA_TANKS_PER_HOUR: '100'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    serverAlive = true;
    serverProc.stderr.on('data', d => console.error('SERVER STDERR:', d.toString().trim()));
    serverProc.on('exit', (code) => {
      serverAlive = false;
    });

    const check = async () => {
      for (let i = 0; i < 30; i++) {
        try {
          const res = await request('GET', '/');
          if (res.status === 200) return resolve();
        } catch (e) {}
        await new Promise(r => setTimeout(r, 150));
      }
      resolve();
    };
    check();
  });
}

async function runTests() {
  console.log('=== Starting Paper Aquarium Test Suite on port ' + TEST_PORT + ' ===\n');
  await ensureServer();

  const results = [];
  function assert(name, condition, details) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      results.push({ name, pass: true });
    } else {
      console.error(`  [FAIL] ${name}: ${JSON.stringify(details)}`);
      results.push({ name, pass: false, details });
    }
  }

  try {
    // 1. Static file serving
    console.log('1. Static File Serving:');
    const resHome = await request('GET', '/');
    assert('GET / serves index.html', resHome.status === 200 && resHome.body.includes('Мои аквариумы'), resHome.status);
    assert('GET / returns anti-cache headers for mobile browsers',
      resHome.headers['cache-control'] && resHome.headers['cache-control'].includes('no-store') && resHome.headers['pragma'] === 'no-cache',
      resHome.headers['cache-control']
    );

    const resPrint = await request('GET', '/print.html');
    assert('GET /print.html serves print page', resPrint.status === 200 && resPrint.body.includes('print'), resPrint.status);

    const resTerms = await request('GET', '/terms.html');
    assert('GET /terms.html serves terms page', resTerms.status === 200 && resTerms.body.includes('Правила и данные'), resTerms.status);

    const resQr = await request('GET', '/qr');
    assert('GET /qr serves qr.html page', resQr.status === 200 && resQr.body.includes('Вход с телефона'), resQr.status);

    const resCapPage = await request('GET', '/capture.html');
    assert('GET /capture.html serves capture page', resCapPage.status === 200 && resCapPage.body.includes('capture.js'), resCapPage.status);

    const resAdminPage = await request('GET', '/admin.html');
    assert('GET /admin.html serves admin page', resAdminPage.status === 200 && resAdminPage.body.includes('three-bootstrap.js'), resAdminPage.status);


    // 2. Security and DoS resilience
    console.log('\n2. Security and DoS Resilience:');
    const rawRes = await rawRequest('GET /%c0%ae%c0%ae HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n');
    assert('Malformed URI percent-encoding returns 400 Bad Request', rawRes.includes('400') || rawRes.includes('bad request'), rawRes.slice(0, 40));
    await new Promise(r => setTimeout(r, 200));
    assert('Server remains alive and functional after malformed URI', serverAlive, 'Server crashed!');

    const resTrav = await request('GET', '/assets/../server.js');
    assert('Path traversal /assets/../ blocked with 404', resTrav.status === 404, resTrav.status);

    // 3. Models Pack API
    console.log('\n3. Models Pack API:');
    const resPack = await request('GET', '/api/pack');
    assert('GET /api/pack returns array of models', Array.isArray(resPack.json) && resPack.json.length === 7, resPack.body);
    const hasDolphin = resPack.json && resPack.json.some(m => m.name === 'bottledolphin' && m.sheet);
    assert('Pack models correctly match coloring manifest species', hasDolphin, resPack.json);

    // 4. Tank Lifecycle and API
    console.log('\n4. Tank Lifecycle & Management API:');
    const resCreate = await request('POST', '/api/tanks', { body: { name: 'Test Aquarium' } });
    assert('POST /api/tanks creates new tank', resCreate.status === 200 && resCreate.json && resCreate.json.id, resCreate.body);

    const tankId = resCreate.json ? resCreate.json.id : null;
    const tankPass = resCreate.json ? resCreate.json.password : null;

    if (tankId) {
      const resMeta = await request('GET', `/api/t/${tankId}/meta`);
      assert('GET /api/t/:id/meta returns public metadata', resMeta.status === 200 && resMeta.json.id === tankId && resMeta.json.locked === true, resMeta.body);

      // Tank pages and routes (prevent 404 regressions for capture and admin in portable/installed builds)
      const resTankPage = await request('GET', `/t/${tankId}`);
      assert('GET /t/:id serves realistic aquarium page', resTankPage.status === 200 && resTankPage.body.includes('canvas'), resTankPage.status);

      const resTankCapture = await request('GET', `/t/${tankId}/capture`);
      assert('GET /t/:id/capture serves fish capture page', resTankCapture.status === 200 && resTankCapture.body.includes('capture.js'), resTankCapture.status);

      const resTankAdmin = await request('GET', `/t/${tankId}/admin`);
      assert('GET /t/:id/admin serves tank admin page', resTankAdmin.status === 200 && resTankAdmin.body.includes('three-bootstrap.js'), resTankAdmin.status);

      const resSettings = await request('GET', `/api/t/${tankId}/settings`);
      assert('GET /api/t/:id/settings returns default settings', resSettings.status === 200 && resSettings.json.bgKind === 'file', resSettings.body);

      // Auth check
      const resAuthOk = await request('POST', `/api/t/${tankId}/auth`, { body: { password: tankPass } });
      assert('POST /api/t/:id/auth succeeds with valid password', resAuthOk.status === 200 && resAuthOk.json.ok, resAuthOk.body);

      const resAuthBad = await request('POST', `/api/t/${tankId}/auth`, { body: { password: 'wrong' } });
      assert('POST /api/t/:id/auth fails with invalid password', resAuthBad.status === 401, resAuthBad.body);

      // Settings update
      const resUpdateSettings = await request('POST', `/api/t/${tankId}/settings`, {
        body: { bgKind: 'shader', bgShaderId: 'particles' }
      });
      assert('POST /api/t/:id/settings updates bgKind and bgShaderId',
        resUpdateSettings.status === 200 && resUpdateSettings.json.bgKind === 'shader' && resUpdateSettings.json.bgShaderId === 'particles',
        resUpdateSettings.body
      );

      // Decor settings update and persistence
      const decorData = { weed: false, bubbles: true, caustics: false };
      const resDecor = await request('POST', `/api/t/${tankId}/settings`, {
        body: { decor: decorData }
      });
      assert('POST /api/t/:id/settings persists decor settings',
        resDecor.status === 200 && resDecor.json.decor && resDecor.json.decor.weed === false && resDecor.json.decor.bubbles === true,
        resDecor.body
      );
      const resGetDecor = await request('GET', `/api/t/${tankId}/settings`);
      assert('GET /api/t/:id/settings returns persisted decor settings',
        resGetDecor.status === 200 && resGetDecor.json.decor && resGetDecor.json.decor.caustics === false,
        resGetDecor.body
      );

      // Feed
      const resFeed = await request('POST', `/api/t/${tankId}/feed`);
      assert('POST /api/t/:id/feed registers feeding time', resFeed.status === 200 && resFeed.json.ok, resFeed.body);

      // Add painted fish
      const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const tinyJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
      const resAddFish = await request('POST', `/api/t/${tankId}/fish`, {
        body: { kind: 'clownfish', texture: tinyPng, name: 'Bubbles' }
      });
      assert('POST /api/t/:id/fish adds painted fish', resAddFish.status === 200 && resAddFish.json.ok, resAddFish.body);
      const fishId = resAddFish.json ? resAddFish.json.id : null;

      if (fishId) {
        const resTex = await request('GET', `/api/t/${tankId}/fish/${fishId}/texture.png`);
        assert('GET /api/t/:id/fish/:fid/texture.png serves fish texture', resTex.status === 200 && resTex.headers['content-type'] === 'image/png', resTex.status);

        const resDelNoAuth = await request('DELETE', `/api/t/${tankId}/fish/${fishId}`);
        assert('DELETE fish without password rejected with 401', resDelNoAuth.status === 401, resDelNoAuth.status);

        const resDelAuth = await request('DELETE', `/api/t/${tankId}/fish/${fishId}`, {
          headers: { 'X-Tank-Pass': tankPass }
        });
        assert('DELETE fish with password succeeds', resDelAuth.status === 200 && resDelAuth.json.ok, resDelAuth.body);
      }

      // Add pack fish
      const resAddPackFish = await request('POST', `/api/t/${tankId}/fish`, {
        body: { type: 'pack', model: 'goldfish2', name: 'Goldie' }
      });
      assert('POST /api/t/:id/fish adds pack model fish', resAddPackFish.status === 200 && resAddPackFish.json.ok, resAddPackFish.body);

      // PIN exchange
      const resPin = await request('POST', `/api/t/${tankId}/pin`);
      assert('POST /api/t/:id/pin issues 5-digit PIN', resPin.status === 200 && resPin.json.pin && resPin.json.pin.length === 5, resPin.body);
      if (resPin.json && resPin.json.pin) {
        const resEx = await request('GET', `/api/pin/${resPin.json.pin}`);
        assert('GET /api/pin/:pin resolves to tankId', resEx.status === 200 && resEx.json.id === tankId, resEx.body);
      }

      // Backgrounds and Settings Preservation on Deletion
      const resBgUpload = await request('POST', `/api/t/${tankId}/backgrounds`, {
        body: { image: tinyPng }
      });
      assert('POST /api/t/:id/backgrounds uploads custom background', resBgUpload.status === 200 && resBgUpload.json.name, resBgUpload.body);
      if (resBgUpload.json && resBgUpload.json.name) {
        const bgName = resBgUpload.json.name;
        const resBgStatic = await request('GET', `/data/tanks/${tankId}/backgrounds/${bgName}`);
        assert('GET /data/tanks/:id/backgrounds/:name serves custom background from DATA_DIR', resBgStatic.status === 200, resBgStatic.status);

        await request('POST', `/api/t/${tankId}/settings`, {
          body: { background: bgName, bgKind: 'file', bgShaderId: 'particles' }
        });
        const resDelBg = await request('DELETE', `/api/t/${tankId}/backgrounds/${bgName}`);
        assert('DELETE /api/t/:id/backgrounds/:name removes custom background', resDelBg.status === 200 && resDelBg.json.ok, resDelBg.body);

        const resSettingsAfter = await request('GET', `/api/t/${tankId}/settings`);
        assert('Settings correctly preserve bgShaderId after active background deletion',
          resSettingsAfter.json && resSettingsAfter.json.bgShaderId === 'particles',
          resSettingsAfter.body
        );
      }

      // Tank preview snapshot and DATA_DIR static serving
      const resPrevUpload = await request('POST', `/api/t/${tankId}/preview`, {
        body: { image: tinyJpeg }
      });
      assert('POST /api/t/:id/preview saves preview snapshot', resPrevUpload.status === 200 && resPrevUpload.json.ok, resPrevUpload.body);

      const resPrevGet = await request('GET', `/data/tanks/${tankId}/preview.jpg`);
      assert('GET /data/tanks/:id/preview.jpg serves snapshot from DATA_DIR', resPrevGet.status === 200, resPrevGet.status);

      // Traversal protection in DATA_DIR
      const resDataTrav = await request('GET', `/data/tanks/${tankId}/../../../server.js`);
      assert('Directory traversal on /data/ blocked with 404', resDataTrav.status === 404, resDataTrav.status);

      // Delete tank
      const resDelTank = await request('DELETE', `/api/t/${tankId}`, {
        headers: { 'X-Tank-Pass': tankPass }
      });
      assert('DELETE /api/t/:id deletes tank with password', resDelTank.status === 200 && resDelTank.json.ok, resDelTank.body);
    }

    // 5. Diagnostics API
    console.log('\n5. Diagnostics API:');
    const resDiag = await request('POST', '/api/diag', {
      body: { type: 'test', ua: 'TestBrowser', backend: 'WebGLBackend' }
    });
    assert('POST /api/diag records diagnostic payload and returns 200 ok', resDiag.status === 200 && resDiag.json && resDiag.json.ok, resDiag.body);

    const resNet = await request('GET', '/api/network');
    assert('GET /api/network returns network interfaces and preferredUrl',
      resNet.status === 200 && resNet.json && resNet.json.preferredUrl && Array.isArray(resNet.json.addresses),
      resNet.body
    );
  } finally {

    if (serverAlive) {
      serverProc.kill();
    }
  }

  console.log('\n========================================');
  const passed = results.filter(r => r.pass).length;
  console.log(`Test Results: ${passed}/${results.length} PASSED`);
  if (passed === results.length) {
    console.log('ALL TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error(`${results.length - passed} TESTS FAILED.\n`);
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Test Suite Fatal Error:', e);
  process.exit(1);
});
