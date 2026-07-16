// sw.js — الرفيق: Service Worker للعمل دون اتصال بالإنترنت
// النسخة 4: مُحسَّنة لتتوافق مع الواجهة الجديدة (SVG مضمّن) وتتحمّل أخطاء التحميل
const CACHE_NAME = 'ar-rafeeq-v9';
const TAFSIR_CACHE = 'ar-rafeeq-tafsir-v1'; // كاش دائم للتفسير الميسّر

// قائمة الملفات الأساسية التي يعتمد عليها التطبيق (بدون صور assets/ لأنها استُبدلت بـ SVG)
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './prayer.html',
  './azkar.html',
  './arbaeen.html',
  './arbaeen-data.json',
  './quran.html',
  './qibla.html',
  './hisnul.html',
  './quran-local.json',
  './audio/adhan.mp3'
];

// ----- التثبيت: تخزين APP_SHELL دون فشل كامل إذا تعذّر ملف واحد -----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          APP_SHELL.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] تعذّر تخزين ' + url, err);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// ----- التنشيط: تنظيف الكاشات القديمة -----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== TAFSIR_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ----- استراتيجيات التحميل حسب نوع المورد -----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isTafsirApi = url.hostname === 'api.alquran.cloud';
  const isPrayerApi = url.hostname === 'api.aladhan.com';

  // 1) موارد التطبيق المحلية (شبكة أولاً، مع تخزين في الكاش)
  if (isSameOrigin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // 2) التفسير الميسّر (كاش أولاً لأنه ثابت)
  if (isTafsirApi) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(TAFSIR_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 3) مواقيت الصلاة (شبكة أولاً إلزامياً لأنها تتغير)
  if (isPrayerApi) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 4) أي طلب خارجي آخر (خطوط Google، أيقونات...): كاش أولاً بسيط
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
