self.addEventListener("install",e=>{
  e.waitUntil(
    caches.open("HYPINEX").then(c=>c.addAll(["/","/SE.html"]))
  );
});
self.addEventListener("fetch",e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
