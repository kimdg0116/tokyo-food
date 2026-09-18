/* 도쿄 맛집 — 오프라인 캐시 */
var VERSION = "26.09.18-1312";
var CACHE = "tf-v" + VERSION;
var CORE = ["./", "./index.html", "./data.json", "./manifest.webmanifest",
            "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];

/* 브라우저 HTTP 캐시를 건너뛰고 서버에서 새로 받는다 */
function fresh(u){ return new Request(u, { cache:"reload" }); }

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){
        return c.addAll(CORE.map(fresh)).then(function(){
          /* 썸네일도 미리 받아둔다 — 지하철·데이터 없는 곳에서도 사진이 보이게.
             하나가 실패해도 설치는 끝나야 하므로 개별로 담는다 */
          return fetch(fresh("./data.json")).then(function(r){ return r.json(); }).then(function(d){
            var names = {};
            d.shops.forEach(function(s){ if (s.thumb) names[s.thumb] = 1; });
            return Promise.all(Object.keys(names).map(function(n){
              var u = "./thumbs/" + encodeURIComponent(n);
              return fetch(u).then(function(res){ if (res.ok) return c.put(u, res); }).catch(function(){});
            }));
          });
        });
      })
      .catch(function(){})
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys()
      .then(function(ks){
        return Promise.all(ks.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  if (e.request.method !== "GET") return;
  if (e.request.url.indexOf("version.json") >= 0) return;
  if (e.request.url.indexOf("tile.openstreetmap.org") >= 0) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: e.request.mode === "navigate" }).then(function(hit){
      if (hit) return hit;
      return fetch(e.request).then(function(res){
        /* 앱 파일 + Leaflet(cdnjs) 만 담는다. 지도 타일은 양이 많아 담지 않는다 */
        var url = e.request.url;
        if (res.ok && (url.indexOf(self.location.origin) === 0 || url.indexOf("https://cdnjs.cloudflare.com/") === 0)){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
        }
        return res;
      }).catch(function(){
        return caches.match("./index.html");
      });
    })
  );
});
