/**
 * linkedin.js — LinkedIn profile import helpers
 *
 * Browsers block cross-origin reads of linkedin.com, so we cannot silently
 * detect sign-in. Import is optional: analysis works from the profile URL alone.
 * For richer results, paste profile text or use the bookmarklet.
 */

export const LINKEDIN_WARRIOR_MESSAGE_SOURCE = 'linkedin-warrior';

const PROFILE_CACHE_KEY = 'linkedin_warrior_profile_import';
const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;

export function getAppOrigin() {
  return window.location.origin;
}

export function buildLinkedInLoginUrl(profileUrl) {
  return `https://www.linkedin.com/uas/login?session_redirect=${encodeURIComponent(profileUrl)}`;
}

export function buildProfileBookmarkletHref(appOrigin = getAppOrigin()) {
  const bookmarkletCode = `(function(){
    var origin=${JSON.stringify(appOrigin)};
    var src=${JSON.stringify(LINKEDIN_WARRIOR_MESSAGE_SOURCE)};
    var path=location.pathname||'';
    var href=location.href||'';
    var onLogin=path.indexOf('/login')!==-1||href.indexOf('authwall')!==-1||path.indexOf('/checkpoint/')!==-1;
    function send(msg){
      if(window.opener&&!window.opener.closed){
        try{window.opener.postMessage(msg,origin);}catch(e1){try{window.opener.postMessage(msg,'*');}catch(e2){}}
        return true;
      }
      return false;
    }
    if(onLogin){
      send({source:src,type:'auth',signedIn:false,url:href,error:'Not signed in — complete LinkedIn login first.'});
      alert('Please sign in to LinkedIn first, then click Import profile again on your profile page.');
      return;
    }
    var text=(document.body&&document.body.innerText)?document.body.innerText.slice(0,50000):'';
    if(text.length<200){
      alert('Could not read enough profile text. Open your full LinkedIn profile (/in/yourname) and try again.');
      return;
    }
    var payload={source:src,type:'profile',signedIn:true,url:href,text:text,fetchedAt:Date.now()};
    if(send(payload)){
      alert('Profile sent to LinkedIn Warrior — switch back to the app tab.');
    }else{
      prompt('Copy this profile text, then paste it into LinkedIn Warrior:',text.slice(0,4000));
    }
  })();`;

  return `javascript:${encodeURIComponent(bookmarkletCode)}`;
}

export function getCachedProfileImport(profileUrl) {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.fetchedAt > PROFILE_CACHE_TTL_MS) {
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
      return null;
    }
    const normalizedTarget = normalizeLinkedInProfileUrl(profileUrl);
    const normalizedCached = normalizeLinkedInProfileUrl(data.url || '');
    if (normalizedTarget && normalizedCached && normalizedTarget !== normalizedCached) {
      return null;
    }
    if (!data.text || data.text.length < 100) return null;
    return data;
  } catch (err) {
    console.warn('linkedin.js: getCachedProfileImport failed:', err);
    return null;
  }
}

export function cacheProfileImport(payload) {
  try {
    sessionStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({
        url: payload.url,
        text: payload.text,
        fetchedAt: payload.fetchedAt || Date.now(),
        signedIn: true,
      }),
    );
  } catch (err) {
    console.warn('linkedin.js: cacheProfileImport failed:', err);
  }
}

export function clearLinkedInProfileCache() {
  sessionStorage.removeItem(PROFILE_CACHE_KEY);
}

export function normalizeLinkedInProfileUrl(url) {
  if (!url) return '';
  let u = url.trim();
  if (!u.includes('://')) u = `https://${u}`;
  u = u.replace(/\/$/, '').split('?')[0].split('#')[0];
  return u.toLowerCase();
}

export function openLinkedInSignIn(profileUrl) {
  return window.open(buildLinkedInLoginUrl(profileUrl), 'linkedin_warrior_auth', 'width=520,height=720');
}

export function openLinkedInProfile(profileUrl) {
  return window.open(profileUrl, 'linkedin_warrior_profile', 'width=520,height=720');
}

function isLinkedInWarriorMessage(event) {
  return event?.data?.source === LINKEDIN_WARRIOR_MESSAGE_SOURCE;
}

/**
 * Optional interactive import — never required for analysis.
 * User can: continue URL-only, paste text, or use bookmarklet postMessage.
 */
export function requestLinkedInProfileImport(profileUrl, uiHandlers = {}) {
  const cached = getCachedProfileImport(profileUrl);
  if (cached) {
    uiHandlers.onStatus?.('Using imported LinkedIn profile…');
    return Promise.resolve({
      signedIn: true,
      profileText: cached.text,
      url: cached.url || profileUrl,
      fromCache: true,
      urlOnly: false,
    });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let removeListener = () => {};

    function finish(result) {
      if (settled) return;
      settled = true;
      removeListener();
      clearTimeout(timeoutId);
      resolve(result);
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      removeListener();
      clearTimeout(timeoutId);
      reject(error);
    }

    function onMessage(event) {
      if (!isLinkedInWarriorMessage(event)) return;
      if (!event.origin.includes('linkedin.com')) return;

      const { type, signedIn, text, url, error } = event.data;

      if (type === 'auth' || signedIn === false) {
        uiHandlers.onStatus?.(error || 'Not signed in on that tab — sign in or paste profile text below.');
        return;
      }

      if (type === 'profile' && text) {
        cacheProfileImport({ url: url || profileUrl, text, fetchedAt: Date.now() });
        uiHandlers.onStatus?.('Profile imported.');
        finish({
          signedIn: true,
          profileText: text,
          url: url || profileUrl,
          fromCache: false,
          urlOnly: false,
        });
      }
    }

    window.addEventListener('message', onMessage);
    removeListener = () => window.removeEventListener('message', onMessage);

    const timeoutId = setTimeout(() => {
      // Do not auto-reject — user may still paste or click continue
    }, uiHandlers.timeoutMs || 300000);

    const controls = {
      profileUrl,
      bookmarkletHref: buildProfileBookmarkletHref(),
      continueUrlOnly() {
        uiHandlers.onStatus?.('Continuing with profile URL…');
        finish({
          signedIn: true,
          profileText: '',
          url: profileUrl,
          fromCache: false,
          urlOnly: true,
        });
      },
      submitPastedText(text) {
        const trimmed = (text || '').trim();
        if (trimmed.length < 100) {
          uiHandlers.onStatus?.('Paste more profile text (headline, about, experience).');
          return false;
        }
        cacheProfileImport({ url: profileUrl, text: trimmed, fetchedAt: Date.now() });
        uiHandlers.onStatus?.('Profile text saved.');
        finish({
          signedIn: true,
          profileText: trimmed,
          url: profileUrl,
          fromCache: false,
          urlOnly: false,
        });
        return true;
      },
      openSignIn: () => openLinkedInSignIn(profileUrl),
      openProfile: () => openLinkedInProfile(profileUrl),
      cancel() {
        fail(new Error('LinkedIn import cancelled.'));
      },
    };

    uiHandlers.onNeedSignIn?.(controls);
    uiHandlers.onStatus?.('Signed in? Continue with your URL, paste profile text, or use Import profile.');
  });
}

/** @deprecated Use requestLinkedInProfileImport — kept for wflow compat */
export async function ensureLinkedInProfileAccess(profileUrl, uiHandlers = {}) {
  return requestLinkedInProfileImport(profileUrl, uiHandlers);
}

export function waitForLinkedInProfileMessage(timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Import timed out. Paste profile text or continue with URL only.'));
    }, timeoutMs);

    function onMessage(event) {
      if (!isLinkedInWarriorMessage(event) || !event.origin.includes('linkedin.com')) return;
      window.removeEventListener('message', onMessage);
      clearTimeout(timeoutId);
      const { type, signedIn, text, url, error } = event.data;
      if (type === 'auth' || signedIn === false) {
        reject(new Error(error || 'Not signed in to LinkedIn.'));
        return;
      }
      if (type === 'profile' && text) {
        cacheProfileImport({ url: url || '', text, fetchedAt: Date.now() });
        resolve({ signedIn: true, profileText: text, url: url || '' });
        return;
      }
      reject(new Error('Unexpected response from LinkedIn.'));
    }

    window.addEventListener('message', onMessage);
  });
}

export function resolveProfileTextForAnalysis(profileUrl, pastedText = '') {
  const cached = getCachedProfileImport(profileUrl);
  if (cached?.text) {
    return { profileText: cached.text, source: 'cache' };
  }
  const trimmed = (pastedText || '').trim();
  if (trimmed.length >= 100) {
    cacheProfileImport({ url: profileUrl, text: trimmed, fetchedAt: Date.now() });
    return { profileText: trimmed, source: 'paste' };
  }
  return { profileText: '', source: 'url' };
}
