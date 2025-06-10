// ==UserScript==
// @name         YouTube Embed 広告回避?
// @namespace    
// @version      1.0
// @description  
// @author       ajdiahi42
// @match        https://www.youtube.com/watch*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  let lastVideoId = null;
  let iframe = null;

  // YouTubeのURLからvideoIdを取得
  const getVideoId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  };

  // 埋め込みiframeを作成
  const createIframe = (videoId) => {
    const embedWrapper = document.createElement('div');
    embedWrapper.id = 'tamper-embed-wrapper';
    embedWrapper.style.position = 'relative';
    embedWrapper.style.width = '100%';
    embedWrapper.style.paddingTop = '56.25%'; // 16:9
    embedWrapper.style.backgroundColor = 'black';

    iframe = document.createElement('iframe');
    iframe.id = 'tamper-embed';
    iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&rel=0&playsinline=1`;
    iframe.style.position = 'absolute';
    iframe.style.top = 0;
    iframe.style.left = 0;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.allowFullscreen = true;

    embedWrapper.appendChild(iframe);
    return embedWrapper;
  };

  // プレイヤー置き換え
  const replacePlayer = (videoId) => {
    const targetContainer = document.querySelector('#player');
    if (!targetContainer) return;

    // 元videoを停止＆ミュート＆非表示（1回だけ）
    startWatchingOriginalVideo();

    // 既存の埋め込みがあれば削除
    const existingEmbed = document.getElementById('tamper-embed-wrapper');
    if (existingEmbed) {
      existingEmbed.remove();
    }

    // iframeを追加
    const newEmbed = createIframe(videoId);
    targetContainer.parentNode.insertBefore(newEmbed, targetContainer.nextSibling);
  };

  // --- 元動画停止＆監視ロジック ---

  let observer = null;
  let checkTimeout = null;

  // 元動画停止・ミュート＆player非表示を実行
  function mutePauseAndHideOriginalVideo() {
    // 元動画のvideoは#player直下に限定して取得
    const player = document.getElementById('player');
    const video = player ? player.querySelector('video') : null;
    if (!video) return false;

    video.pause();
    video.muted = true;
    video.volume = 0;

    if (player) {
      player.style.display = 'none';
    }

    const containers = document.querySelectorAll('.html5-video-container');
    containers.forEach(el => {
      el.style.display = 'none';
    });

    console.log('元の動画停止＆ミュート＆player非表示');

    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (checkTimeout) {
      clearTimeout(checkTimeout);
      checkTimeout = null;
    }
    return true;
  }

  // 元videoのplayイベント監視して再生開始されたら即停止・ミュートに戻す
  function watchOriginalVideoPlayEvents() {
    const player = document.getElementById('player');
    const video = player ? player.querySelector('video') : null;
    if (!video) return;

    if (video._hasPlayEventListener) return;
    video._hasPlayEventListener = true;

    video.addEventListener('play', () => {
      console.log('元video playイベント検知 → 再度停止＆ミュート');
      video.pause();
      video.muted = true;
      video.volume = 0;
    });
  }

  // 元動画のvideoタグ出現を最大10秒監視し停止・ミュート実行
  function startWatchingOriginalVideo() {
    if (observer) observer.disconnect();

    if (mutePauseAndHideOriginalVideo()) {
      watchOriginalVideoPlayEvents();
      return;
    }

    observer = new MutationObserver(() => {
      if (mutePauseAndHideOriginalVideo()) {
        watchOriginalVideoPlayEvents();
        observer.disconnect();
        observer = null;
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    if (checkTimeout) clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      console.log('元動画監視タイムアウト（videoタグ出現せず）');
    }, 10000);
  }

  // --- 履歴変更監視 ---

  // history.pushState/replaceState のhook
  function hookHistoryMethod(method) {
    const original = history[method];
    return function () {
      const result = original.apply(this, arguments);
      window.dispatchEvent(new Event(method));
      return result;
    };
  }
  history.pushState = hookHistoryMethod('pushState');
  history.replaceState = hookHistoryMethod('replaceState');

  // 履歴変更イベントでプレイヤー置換・監視再スタート
  ['popstate', 'pushState', 'replaceState'].forEach(evt => {
    window.addEventListener(evt, () => {
      console.log(`履歴変更検知: ${evt}`);
      const currentVideoId = getVideoId();
      if (currentVideoId && currentVideoId !== lastVideoId) {
        lastVideoId = currentVideoId;
        replacePlayer(currentVideoId);
      }
      startWatchingOriginalVideo();
    });
  });

  // 初回起動処理
  const init = () => {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const currentVideoId = getVideoId();
        if (currentVideoId) {
          lastVideoId = currentVideoId;
          replacePlayer(currentVideoId);
        }
        startWatchingOriginalVideo();

        // 動画ID変化チェック（URLパラメータ監視）
        setInterval(() => {
          const vid = getVideoId();

          // watchページならプレイヤー入れ替え
          if (vid && vid !== lastVideoId) {
            lastVideoId = vid;
            replacePlayer(vid);
          }

          // watchページでない場合 → 埋め込みを削除
          if (!vid) {
            const existingEmbed = document.getElementById('tamper-embed-wrapper');
            if (existingEmbed) {
              existingEmbed.remove();
              console.log('iframe削除（watchページ外へ移動）');
            }

            // playerを再表示（非表示解除）
            const player = document.getElementById('player');
            if (player) {
              player.style.display = '';
            }

            document.querySelectorAll('.html5-video-container').forEach(el => {
              el.style.display = '';
            });
          }
        }, 1000);

      }, 1000);
    });
  };

  init();
})();
