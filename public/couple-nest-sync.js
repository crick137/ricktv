/**
 * Couple Nest x MoonTV(ricktv) watch-party bridge
 * Supports: window.__coupleNestPlayer / video / ArtPlayer
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__COUPLE_NEST_SYNC__) return;
  window.__COUPLE_NEST_SYNC__ = true;

  var SOURCE = "couple-nest";
  var lastEmit = 0;
  var lastT = -1;
  var hooked = null;

  function post(payload) {
    var msg = JSON.stringify(
      Object.assign({ source: SOURCE, type: "event", href: location.href }, payload)
    );
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      }
    } catch (e) {}
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, "*");
      }
    } catch (e) {}
  }

  function getApi() {
    return window.__coupleNestPlayer || null;
  }

  function findArt() {
    var nodes = document.querySelectorAll(
      ".artplayer-app, .art-video-player, [class*=\"artplayer\"]"
    );
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.art && typeof n.art.play === "function") return n.art;
    }
    if (window.art && typeof window.art.play === "function") return window.art;
    return null;
  }

  function findVideo() {
    return (
      document.querySelector("media-player video") ||
      document.querySelector("video") ||
      null
    );
  }

  function getState() {
    var api = getApi();
    if (api && typeof api.getState === "function") {
      var s = api.getState() || {};
      return {
        hasPlayer: true,
        player: "coupleNestPlayer",
        playing: !!s.playing,
        currentTime: s.currentTime || 0,
        duration: s.duration || 0,
        title: document.title || "",
      };
    }
    var art = findArt();
    if (art) {
      var ct =
        typeof art.currentTime === "number"
          ? art.currentTime
          : (art.video && art.video.currentTime) || 0;
      var dur =
        typeof art.duration === "number"
          ? art.duration
          : (art.video && art.video.duration) || 0;
      return {
        hasPlayer: true,
        player: "art",
        playing: !!(art.playing || (art.video && !art.video.paused)),
        currentTime: ct || 0,
        duration: dur || 0,
        title: document.title || "",
      };
    }
    var v = findVideo();
    if (v) {
      return {
        hasPlayer: true,
        player: "video",
        playing: !v.paused && !v.ended,
        currentTime: v.currentTime || 0,
        duration: v.duration || 0,
        title: document.title || "",
      };
    }
    return {
      hasPlayer: false,
      player: "none",
      playing: false,
      currentTime: 0,
      duration: 0,
      title: document.title || "",
    };
  }

  function emitState(force) {
    var st = getState();
    var now = Date.now();
    if (
      !force &&
      now - lastEmit < 800 &&
      Math.abs((st.currentTime || 0) - lastT) < 0.35
    ) {
      return;
    }
    lastEmit = now;
    lastT = st.currentTime || 0;
    post(Object.assign({ event: "state" }, st));
  }

  function doPlay() {
    var api = getApi();
    if (api && api.play) {
      try { api.play(); } catch (e) {}
      return true;
    }
    var art = findArt();
    if (art) {
      try { art.play(); } catch (e) {}
      return true;
    }
    var v = findVideo();
    if (v) {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    }
    return false;
  }

  function doPause() {
    var api = getApi();
    if (api && api.pause) {
      try { api.pause(); } catch (e) {}
      return true;
    }
    var art = findArt();
    if (art) {
      try { art.pause(); } catch (e) {}
      return true;
    }
    var v = findVideo();
    if (v) {
      v.pause();
      return true;
    }
    return false;
  }

  function doSeek(t) {
    t = Math.max(0, Number(t) || 0);
    var api = getApi();
    if (api && api.seek) {
      try { api.seek(t); } catch (e) {}
      return true;
    }
    var art = findArt();
    if (art) {
      try { art.currentTime = t; } catch (e) {}
      return true;
    }
    var v = findVideo();
    if (v) {
      try { v.currentTime = t; } catch (e) {}
      return true;
    }
    return false;
  }

  function hookMedia() {
    var api = getApi();
    if (api) {
      if (!api.__cnHooked) {
        api.__cnHooked = true;
        post({
          event: "ready",
          hasPlayer: true,
          player: "coupleNestPlayer",
          currentTime: 0,
          duration: 0,
          playing: false,
          title: document.title || "",
        });
      }
      return;
    }
    var v = findVideo();
    if (!v || v === hooked) return;
    hooked = v;
    ["play", "pause", "seeked", "ended", "loadedmetadata"].forEach(function (ev) {
      v.addEventListener(ev, function () { emitState(true); });
    });
    v.addEventListener("timeupdate", function () { emitState(false); });
    post({
      event: "ready",
      hasPlayer: true,
      player: "video",
      currentTime: v.currentTime || 0,
      duration: v.duration || 0,
      playing: !v.paused,
      title: document.title || "",
    });
  }

  function onMessage(ev) {
    var data = ev && ev.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) { return; }
    }
    if (!data || data.source !== SOURCE || data.type !== "cmd") return;

    if (data.action === "hello") {
      post({ event: "hello", hasPlayer: !!(getApi() || findVideo() || findArt()) });
      emitState(true);
    } else if (data.action === "play") {
      doPlay(); emitState(true);
    } else if (data.action === "pause") {
      doPause(); emitState(true);
    } else if (data.action === "seek") {
      doSeek(data.t); emitState(true);
    } else if (data.action === "getState") {
      emitState(true);
    } else if (data.action === "playSeek") {
      doSeek(data.t); doPlay(); emitState(true);
    } else if (data.action === "pauseSeek") {
      doSeek(data.t); doPause(); emitState(true);
    }
  }

  window.addEventListener("message", onMessage);
  document.addEventListener("message", onMessage);

  setInterval(function () {
    hookMedia();
    if (getApi()) emitState(false);
  }, 1000);

  var lastHref = location.href;
  setInterval(function () {
    if (location.href !== lastHref) {
      lastHref = location.href;
      hooked = null;
      post({
        event: "navigated",
        href: location.href,
        title: document.title || "",
        hasPlayer: false,
      });
      emitState(true);
    }
  }, 800);

  post({ event: "hello", hasPlayer: false, href: location.href });
  console.log("[couple-nest-sync] ready");
})();