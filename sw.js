// sw.js — الرفيق: Service Worker للعمل دون اتصال بالإنترنت
// النسخة 3: quran-local.json (114 سورة كاملة محلياً) يحل محل التخزين الاستباقي الجزئي السابق
const CACHE_NAME = 'ar-rafeeq-v8';
const TAFSIR_CACHE = 'ar-rafeeq-tafsir-v1'; // كاش دائم للتفسير الميسّر (نص ثابت لا يتغير)

// كل ملفات التطبيق + النص الكامل للقرآن (quran-local.json) — تُخزَّن عند أول تثبيت
// بعدها القرآن الكريم بأكمله متاح فوراً دون اتصال، وليس فقط جزء عمّ كما في الإصدار السابق
const APP_SHELL = [
  './', './index.html', './style.css',
  './prayer.html', './azkar.html',
  './arbaeen.html', './arbaeen-data.json',
  './quran.html', './qibla.html', './hisnul.html',
  './quran-local.json',
  './audio/adhan.mp3',
  './assets/medallion.png', './assets/quran.png', './assets/books.png',
  './assets/tasbih.png', './assets/shield.png', './assets/sun.png',
  './assets/topright.png', './assets/skyline.png', './assets/adhanmosque.png',
  './assets/qibla_q.png', './assets/adiya_q.png', './assets/mawaqit_q.png', './assets/more_q.png',
  './assets/nav_more.png', './assets/nav_hadith.png', './assets/nav_home.png',
  './assets/nav_quran.png', './assets/nav_qibla.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isTafsirApi = url.hostname === 'api.alquran.cloud';
  const isPrayerApi = url.hostname === 'api.aladhan.com';

  if (isSameOrigin) {
    // شبكة أولاً لملفات التطبيق (بما فيها quran-local.json نفسه، لتحديثه إن غُيِّر مستقبلاً)
    // مع سقوط فوري للكاش عند انعدام الاتصال — وهذا ما يجعل القرآن يعمل دون إنترنت من أول استخدام
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

  if (isTafsirApi) {
    // كاش أولاً — نص التفسير الميسّر ثابت ولا يتغير، فالتخزين الدائم صحيح هنا
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

  if (isPrayerApi) {
    // شبكة أولاً إلزامياً — مواقيت الصلاة تتغيّر يومياً، فلا يصح تخزينها بشكل دائم
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

  // أي طلب خارجي آخر (خطوط Google Fonts مثلاً): كاش أولاً بسيط
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
