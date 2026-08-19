/* ============================================================================
   tracking.js  —  GA4 이벤트 추적 (랜딩페이지 공용)
   ----------------------------------------------------------------------------
   이 파일 하나로 모든 랜딩페이지의 GA4 추적이 처리됩니다.
   각 HTML은 </body> 앞에 <script src="tracking.js"></script> 한 줄만 있으면 됨.

   ▣ 딱 하나만 교체하세요 (선배가 GA4 측정 ID 주면):
        아래 GA4_ID 값의 "G-XXXXXXXXXX" 를 실제 ID로 바꿉니다.
        예) const GA4_ID = 'G-ABC123XYZ';

   ▣ 잡는 이벤트 (4개)
        page_view        - 페이지 도착 (GA가 자동으로 잡음, 코드 불필요)
        cta_click        - '#survey'로 가는 CTA 버튼 클릭 (설문으로 가려는 의향)
        survey_start     - 설문 첫 답 클릭 (실제 설문 진입)
        survey_complete  - 설문 제출 성공 (전환 = 핵심 지표)
                           └ 어떤 답을 골랐는지(언어·응답값)도 함께 전송

   ▣ 동작 안 하는 경우
        - 측정 ID를 안 넣으면(G-XXXXXXXXXX 그대로면) GA 전송을 건너뜁니다.
          → 콘솔에만 로그가 찍혀서, 배포 전 테스트가 가능합니다.
        - localhost/파일 열기에서도 콘솔 로그로 확인 가능.
   ============================================================================ */

(function () {
  'use strict';

  /* ▼▼▼ 여기만 교체 ▼▼▼ */
  var GA4_ID = 'G-0MH9230B7L';
  /* ▲▲▲ 여기만 교체 ▲▲▲ */

  var idReady = /^G-[A-Z0-9]+$/i.test(GA4_ID) && GA4_ID !== 'G-XXXXXXXXXX';

  /* ---- GA4(gtag) 로드 : ID가 준비됐을 때만 ---- */
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }

  if (idReady) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);

    gtag('js', new Date());
    gtag('config', GA4_ID);
  } else {
    console.warn('[tracking] GA4 측정 ID가 아직 없습니다. 이벤트는 콘솔에만 기록됩니다.');
  }

  /* ---- 이벤트 전송 헬퍼 ---- */
  function sendEvent(name, params) {
    params = params || {};
    if (idReady && typeof gtag === 'function') {
      gtag('event', name, params);
    }
    console.log('[tracking] ' + name, params);
  }

  /* ---- 페이지에서 실행 ---- */
  function init() {

    /* 1) CTA 클릭 : href가 #survey 로 가는 모든 버튼/링크 */
    document.querySelectorAll('a[href="#survey"]').forEach(function (el) {
      el.addEventListener('click', function () {
        sendEvent('cta_click', {
          location: el.closest('.mobile-sticky') ? 'sticky'
                  : el.closest('.hero')          ? 'hero'
                  : el.closest('.header')        ? 'header'
                  : el.closest('.final-cta')     ? 'final'
                  : 'other'
        });
      });
    });

    /* 2) 설문 시작 : 설문 영역 안의 옵션(.option)을 처음 누른 순간 1회만 */
    var surveyStarted = false;
    var surveyRoot = document.getElementById('survey');
    if (surveyRoot) {
      surveyRoot.addEventListener('click', function (e) {
        var opt = e.target.closest('.option');
        if (opt && !surveyStarted) {
          surveyStarted = true;
          sendEvent('survey_start', {});
        }
      });
    }

    /* 3) 설문 완료 : 성공 화면(#surveySuccess)이 표시되는 순간 감지
          - 템플릿은 완료 시 #surveySuccess 에 'show' 클래스를 추가함
          - 그 변화를 MutationObserver 로 관찰해 1회만 전송 */
    var success = document.getElementById('surveySuccess');
    if (success && 'MutationObserver' in window) {
      var fired = false;
      var mo = new MutationObserver(function () {
        if (!fired && success.classList.contains('show')) {
          fired = true;

          /* 완료 시점에 사용자가 고른 답을 함께 전송
             (요약 화면 #surveySummary 의 값들을 읽어 담음) */
          var params = { language: document.documentElement.lang || 'ko' };
          try {
            var rows = document.querySelectorAll('#surveySummary .summary-row');
            rows.forEach(function (row, i) {
              var val = row.querySelector('strong');
              if (val) params['answer_' + (i + 1)] = val.textContent.trim().slice(0, 90);
            });
          } catch (err) { /* 요약 못 읽어도 완료 자체는 기록 */ }

          sendEvent('survey_complete', params);
        }
      });
      mo.observe(success, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
