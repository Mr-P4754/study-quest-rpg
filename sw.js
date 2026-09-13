// ============================================================================
// STUDY QUEST RPG - Service Worker (sw.js)
// Ver 10.5.0: 持ち物機能＆持ち物ガチャ対応
// ============================================================================

const CACHE_NAME = 'sq-static-v10.5.0';

// プレキャッシュ対象静的アセット一覧 (FR-03)
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.svg',
    './icons/icon-512.svg',
    './css/base.css?v=10.5.0',
    './css/layout.css?v=10.5.0',
    './css/components.css?v=10.5.0',
    './css/quests.css?v=10.5.0',
    './css/special-quest.css?v=10.5.0',
    './css/studyel.css?v=10.5.0',
    './js/main.js?v=10.5.0',
    './js/state.js?v=10.5.0',
    './js/studyel-engine.js?v=10.5.0',
    './js/utils.js?v=10.5.0',
    './js/api.js?v=10.5.0',
    './js/battle-core.js?v=10.5.0',
    './js/quest-normal.js?v=10.5.0',
    './js/quest-explore.js?v=10.5.0',
    './js/gacha-shop.js?v=10.5.0',
    './js/ui-manager.js?v=10.5.0',
    './js/special-quest-engine.js?v=10.5.0',
    './js/avatar-engine.js?v=10.5.0',
    './js/farm-engine.js?v=10.5.0',
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
    'https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&display=swap'
];

/**
 * Service Worker インストールイベント
 * 静的アセットを CacheStorage に事前格納し即時待機解除 (FR-03, FR-06)
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[SW] プレキャッシュ開始:', CACHE_NAME);
            for (const asset of PRECACHE_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.warn('[SW] プレキャッシュ個別スキップ:', asset, err.message);
                }
            }
            console.log('[SW] プレキャッシュ完了');
        }).then(() => self.skipWaiting())
    );
});

/**
 * Service Worker アクティベートイベント
 * 旧バージョンの静的キャッシュを自動走査して完全破棄 (FR-06)
 */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key.startsWith('sq-static-')) {
                        console.log('[SW] 旧バージョンキャッシュ破棄:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

/**
 * フェッチ制御イベント (FR-04, FR-05)
 * - GAS API 通信は完全バイパス (FR-05)
 * - JS/CSS/ナビゲーションは Network First（最新コード優先＆フォールバックキャッシュ）
 * - その他画像・フォントは Cache First
 */
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // GAS API 通信の物理的除外（バイパス）
    if (
        url.hostname.includes('script.google.com') ||
        url.hostname.includes('script.googleusercontent.com') ||
        url.hostname.includes('drive.google.com') ||
        url.searchParams.has('action') ||
        url.searchParams.has('grade')
    ) {
        return;
    }

    // ナビゲーションリクエスト（index.html 読み込み）
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const resClone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                    }
                    return networkRes;
                })
                .catch(async () => {
                    const cached = await caches.match('./index.html') ||
                                   await caches.match('./') ||
                                   await caches.match(req);
                    return cached || new Response('オフラインです', { status: 503, statusText: 'Offline' });
                })
        );
        return;
    }

    // スクリプト（JS）およびスタイル（CSS）は Network First で取得し、キャッシュ不整合を根絶
    const isScriptOrStyle = url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.includes('/js/') || url.pathname.includes('/css/');
    if (isScriptOrStyle) {
        event.respondWith(
            fetch(req)
                .then((networkRes) => {
                    if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
                        const resClone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone).catch(() => {}));
                    }
                    return networkRes;
                })
                .catch(async () => {
                    // オフライン時はキャッシュから返却
                    const cached = await caches.match(req);
                    if (cached) return cached;
                    const urlWithoutQuery = req.url.split('?')[0];
                    return await caches.match(urlWithoutQuery) || new Response('', { status: 408 });
                })
        );
        return;
    }

    // 画像・フォント等は Cache First
    event.respondWith(
        caches.match(req).then((cachedRes) => {
            if (cachedRes) return cachedRes;
            return fetch(req)
                .then((networkRes) => {
                    if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
                        const resClone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone).catch(() => {}));
                    }
                    return networkRes;
                })
                .catch(async () => {
                    const urlWithoutQuery = req.url.split('?')[0];
                    return await caches.match(urlWithoutQuery) || new Response('', { status: 408 });
                });
        })
    );
});
