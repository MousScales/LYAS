(function () {
  const sentOnce = new Set();

  function canTrack() {
    return typeof window.va === "function";
  }

  function fireEvent(eventName, payload) {
    if (!canTrack()) return;
    const data = payload || {};
    try {
      window.va("event", { name: eventName, data: data });
    } catch (err) {
      try {
        window.va("event", eventName, data);
      } catch (_) {
        // Ignore analytics transport errors.
      }
    }
  }

  function fireOnce(key, eventName, payload) {
    if (sentOnce.has(key)) return;
    sentOnce.add(key);
    fireEvent(eventName, payload);
  }

  function getTextLabel(el) {
    if (!el) return "";
    return (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 120);
  }

  function initPageEvents() {
    fireEvent("page_loaded", {
      path: window.location.pathname,
      title: document.title
    });

    const start = Date.now();
    const engagedTimers = [15000, 45000, 90000];
    engagedTimers.forEach((ms) => {
      window.setTimeout(function () {
        fireOnce("engaged_" + ms, "engaged_time", {
          seconds: Math.floor(ms / 1000),
          path: window.location.pathname
        });
      }, ms);
    });

    window.addEventListener("pagehide", function () {
      const durationMs = Date.now() - start;
      fireEvent("time_on_page", {
        path: window.location.pathname,
        seconds: Math.round(durationMs / 1000)
      });
    });
  }

  function initClickTracking() {
    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!target) return;

      const anchor = target.closest("a");
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        const label = getTextLabel(anchor);
        if (href.startsWith("tel:")) {
          fireEvent("phone_click", { href: href, label: label });
        } else if (href.startsWith("#")) {
          fireEvent("in_page_nav_click", { href: href, label: label });
        } else {
          fireEvent("link_click", { href: href, label: label });
        }
      }

      const button = target.closest("button");
      if (button) {
        fireEvent("button_click", {
          label: getTextLabel(button),
          className: (button.className || "").toString().slice(0, 120)
        });
      }
    });
  }

  function initScrollDepth() {
    const marks = [25, 50, 75, 90, 100];
    const seen = new Set();

    function onScroll() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      const depth = Math.round((window.scrollY / maxScroll) * 100);
      marks.forEach(function (mark) {
        if (depth >= mark && !seen.has(mark)) {
          seen.add(mark);
          fireEvent("scroll_depth", { percent: mark, path: window.location.pathname });
        }
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initSectionViews() {
    const sections = document.querySelectorAll("section[id], .program-shell, .gallery-showcase");
    if (sections.length === 0 || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const id = el.id || getTextLabel(el.querySelector("h1, h2, h3")) || el.className || "unknown";
          fireOnce("section_" + id, "section_view", {
            section: id.toString().slice(0, 120),
            path: window.location.pathname
          });
        });
      },
      { threshold: 0.45 }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  function initMediaTracking() {
    const images = document.querySelectorAll("main img");
    images.forEach(function (img) {
      img.addEventListener("load", function () {
        fireOnce("img_load_" + (img.currentSrc || img.src), "image_loaded", {
          src: (img.currentSrc || img.src || "").slice(0, 180)
        });
      });
      img.addEventListener("error", function () {
        fireEvent("image_error", {
          src: (img.currentSrc || img.src || "").slice(0, 180)
        });
      });
    });

    const videos = document.querySelectorAll("video");
    videos.forEach(function (video) {
      const srcNode = video.querySelector("source");
      const src = srcNode && srcNode.getAttribute("src") ? srcNode.getAttribute("src") : (video.currentSrc || "");
      const videoId = src.slice(0, 180);

      video.addEventListener("loadeddata", function () {
        fireOnce("video_loaded_" + videoId, "video_loaded", { src: videoId });
      });
      video.addEventListener("play", function () {
        fireEvent("video_play", { src: videoId, currentTime: Math.floor(video.currentTime || 0) });
      });
      video.addEventListener("pause", function () {
        fireEvent("video_pause", { src: videoId, currentTime: Math.floor(video.currentTime || 0) });
      });
      video.addEventListener("ended", function () {
        fireEvent("video_complete", { src: videoId });
      });
      video.addEventListener("error", function () {
        fireEvent("video_error", { src: videoId });
      });
    });
  }

  function initGalleryTracking() {
    document.querySelectorAll(".gallery-thumb, .program-thumb").forEach(function (thumb) {
      thumb.addEventListener("click", function () {
        fireEvent("gallery_item_click", {
          src: (thumb.getAttribute("data-src") || "").slice(0, 180),
          alt: (thumb.getAttribute("data-alt") || "").slice(0, 120)
        });
      });
    });

    document.querySelectorAll(".lightbox, .lightbox-close").forEach(function (node) {
      node.addEventListener("click", function () {
        fireEvent("lightbox_interaction", {
          target: node.className ? node.className.toString().slice(0, 120) : "lightbox"
        });
      });
    });
  }

  function init() {
    initPageEvents();
    initClickTracking();
    initScrollDepth();
    initSectionViews();
    initMediaTracking();
    initGalleryTracking();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
