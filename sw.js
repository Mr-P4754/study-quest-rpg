// ============================================================================
// STUDY QUEST RPG - Service Worker (sw.js)
// Ver 10.2.4: PWA・オフラインファースト・静的アセット完全キャッシュ
// ============================================================================

const CACHE_NAME = 'sq-static-v10.2.4';

// プレキャッシュ対象静的アセット一覧 (FR-03)
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.svg',
    './icons/icon-512.svg',
    './css/base.css?v=10.2.4',
    './css/layout.css?v=10.2.4',
    './css/components.css?v=10.2.4',
    './css/quests.css?v=10.2.4',
    './css/special-quest.css?v=10.2.4',
    './css/studyel.css?v=10.2.4',
    './js/main.js?v=10.2.4',
    './js/state.js?v=10.2.4',
    './js/studyel-engine.js?v=10.2.4',
    './js/utils.js?v=10.2.4',
    './js/api.js?v=10.2.4',
    './js/battle-core.js?v=10.2.4',
    './js/quest-normal.js?v=10.2.4',
    './js/quest-explore.js?v=10.2.4',
    './js/gacha-shop.js?v=10.2.4',
    './js/ui-manager.js?v=10.2.4',
    './js/special-quest-engine.js?v=10.2.4',
    './js/avatar-engine.js?v=10.2.4',
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
            // 外部CDNや一部ファイルが通信失敗しても全体が壊れないよう個別に安全格納
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
 * - GAS API 通信 (script.google.com, Googleドライブ, action/gradeパラメータ) は完全バイパス (FR-05)
 * - 静的アセットは Cache First, Network Fallback (FR-04)
 * - オフライン時のナビゲーション要求には index.html をフォールバック返却 (FR-04)
 */
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // ============================================================
    // 【FR-05: GAS API通信の物理的除外（バイパス）】
    // 既存の IndexedDB SWR キャッシュおよび CloudSyncQueue に委託
    // ============================================================
    if (
        url.hostname.includes('script.google.com') ||
        url.hostname.includes('script.googleusercontent.com') ||
        url.hostname.includes('drive.google.com') ||
        url.searchParams.has('action') ||
        url.searchParams.has('grade')
    ) {
        // SW は介入せず、通常のブラウザネットワーク通信に任せる
        return;
    }

    // ============================================================
    // ナビゲーションリクエスト（画面遷移 / アプリ起動） (FR-04)
    // ============================================================
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
                    console.log('[SW] ナビゲーションオフライン検知: index.html をフォールバック返却');
                    const cached = await caches.match('./index.html') ||
                                   await caches.match('./') ||
                                   await caches.match(req);
                    return cached || new Response('オフラインです', { status: 503, statusText: 'Offline' });
                })
        );
        return;
    }

    // ============================================================
    // 静的アセット（HTML, CSS, JS, 画像, フォント等） (FR-04)
    // キャッシュファースト ➔ ネットワークフォールバック ➔ 動的キャッシュ保存
    // ============================================================
    event.respondWith(
        caches.match(req).then((cachedRes) => {
            if (cachedRes) {
                return cachedRes;
            }

            // キャッシュ未ヒット時はネットワーク取得
            return fetch(req)
                .then((networkRes) => {
                    // 正常なレスポンス（または CORS opaque レスポンス）のみキャッシュ
                    if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
                        const resClone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(req, resClone).catch(() => {});
                        });
                    }
                    return networkRes;
                })
                .catch(async (fetchErr) => {
                    // クエリパラメータの差異（例: ?ts=... や ?v=...）に対応する柔軟フォールバック検索
                    const urlWithoutQuery = req.url.split('?')[0];
                    const fallbackMatch = await caches.match(urlWithoutQuery);
                    if (fallbackMatch) {
                        return fallbackMatch;
                    }
                    // 画像等のフォールバック
                    return new Response('', { status: 408, statusText: 'Request Timed Out' });
                });
        })
    );
});
