/* ============================================================================
   tracking.js  —  GA4 이벤트 추적 (랜딩페이지 공용)
   ----------------------------------------------------------------------------
   이 파일 하나로 모든 랜딩페이지의 GA4 추적이 처리됩니다.
   각 HTML은 </body> 앞에 <script src="tracking.js"></script> 한 줄만 있으면 됨.

   ▣ 딱 하나만 교체하세요 (선배가 GA4 측정 ID 주면):
        아래 GA4_ID 값의 "G-XXXXXXXXXX" 를 실제 ID로 바꿉니다.

   ▣ 페이지 이름 문제 해결 (NEW)
        모든 페이지가 루트(/)에 배포돼 GA 경로가 전부 '/' 로만 보이던 문제를,
        각 페이지의 <title>을 읽어 GA에 '보기 좋은 경로 이름'으로 넘겨 해결합니다.
        → GA4 '페이지 경로' 카드에도 /protection, /ai-call-assistant 처럼 뜹니다.
        → HTML은 수정할 필요 없음. 이 파일 하나로 5개 페이지 전부 적용.

        새 페이지를 추가하면, 아래 PAGE_MAP 에 [제목 일부, 경로이름] 한 줄만 추가.
        매핑에 없으면 title을 자동 슬러그로 만들어 넣습니다(그래도 '/' 보단 명확).

   ▣ 잡는 이벤트 (4개)
        page_view / cta_click / survey_start / survey_complete
   ============================================================================ */

(function () {
  'use strict';

  /* ▼▼▼ 여기만 교체 ▼▼▼ */
  var GA4_ID = 'G-0MH9230B7L';
  /* ▲▲▲ 여기만 교체 ▲▲▲ */

  /* ▼▼▼ 페이지 이름 매핑 (title 에 이 문자열이 포함되면 → 해당 경로로 GA에 기록) ▼▼▼
     - 왼쪽: 각 페이지 <title> 에 들어있는 '구분되는 문자열' (일부만 매칭돼도 됨)
     - 오른쪽: GA4 경로 카드에 뜰 이름 (반드시 / 로 시작)
     - 새 페이지가 생기면 여기에 한 줄만 추가하세요. */
  var PAGE_MAP = [
    ['가족에게 걸려온',   '/protection'],
    ['AI전화비서',        '/ai-call-assistant'],
    ['팩트체크',          '/factcheck'],
    ['SOHO',             '/soho'],
    ['Protection',        '/protection']
  ];
  /* ▲▲▲ 페이지 이름 매핑 ▲▲▲ */

  var idReady = /^G-[A-Z0-9]+$/i.test(GA4_ID) && GA4_ID !== 'G-XXXXXXXXXX';

  /* ---- title → GA 경로 이름 결정 ---- */
  function resolvePagePath() {
    var title = (document.title || '').trim();

    // 1) 매핑에서 제목 포함 검색
    for (var i = 0; i < PAGE_MAP.length; i++) {
      if (title.indexOf(PAGE_MAP[i][0]) !== -1) return PAGE_MAP[i][1];
    }

    // 2) 매핑에 없으면: title 앞부분을 슬러그로 (한글/영문/숫자만, 공백→하이픈)
    var slug = title
      .split(/[—\-|·:]/)[0]        // 제목 구분자 앞부분만
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9가-힣\-]/g, '')
      .slice(0, 40);

    if (slug) return '/' + slug;

    // 3) 그래도 없으면 실제 경로 사용 (최후의 폴백)
    return location.pathname || '/';
  }

  var PAGE_PATH = resolvePagePath();

  /* ---- GA4(gtag) 로드 : ID가 준비됐을 때만 ---- */
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }

  if (idReady) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);

    gtag('js', new Date());
    // page_path 를 명시해 실제 URL이 '/' 여도 GA에는 페이지 이름으로 기록되게 함.
    // page_title 은 원래 title 그대로 유지(제목 카드도 계속 정상).
    gtag('config', GA4_ID, {
      page_path: PAGE_PATH,
      page_title: document.title
    });
  } else {
    console.warn('[tracking] GA4 측정 ID가 아직 없습니다. 이벤트는 콘솔에만 기록됩니다.');
  }

  /* ---- 이벤트 전송 헬퍼 ---- */
  function sendEvent(name, params) {
    params = params || {};
    // 모든 이벤트에 페이지 식별자를 함께 실어, 페이지별 비교를 쉽게 함
    params.page_path = PAGE_PATH;
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

    /* 3) 설문 완료 : 성공 화면(#surveySuccess)에 'show' 클래스가 붙는 순간 감지 */
    var success = document.getElementById('surveySuccess');
    if (success && 'MutationObserver' in window) {
      var fired = false;
      var mo = new MutationObserver(function () {
        if (!fired && success.classList.contains('show')) {
          fired = true;
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
