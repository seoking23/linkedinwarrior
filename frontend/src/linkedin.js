/**
 * linkedin.js — LinkedIn profile import helpers
 *
 * Browsers block cross-origin reads of linkedin.com, so we cannot silently
 * detect sign-in. Import is optional: analysis works from the profile URL alone.
 * For richer results, paste profile text or use the bookmarklet on a signed-in tab.
 */

export const LINKEDIN_WARRIOR_MESSAGE_SOURCE = 'linkedin-warrior';

const PROFILE_CACHE_KEY = 'linkedin_warrior_profile_import';
const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;
const MIN_PROFILE_TEXT_LENGTH = 100;

export function getAppOrigin() {
  return window.location.origin;
}

export function buildLinkedInLoginUrl(profileUrl) {
  return `https://www.linkedin.com/uas/login?session_redirect=${encodeURIComponent(profileUrl)}`;
}

export function buildProfileBookmarkletHref(appOrigin = getAppOrigin()) {
  const bookmarkletCode = `(async function(){
    var origin=${JSON.stringify(appOrigin)};
    var src=${JSON.stringify(LINKEDIN_WARRIOR_MESSAGE_SOURCE)};
    var path=location.pathname||'';
    var href=location.href||'';
    var onLogin=path.indexOf('/login')!==-1||href.indexOf('authwall')!==-1||path.indexOf('/checkpoint/')!==-1;

    function send(msg){
      if(window.opener&&!window.opener.closed){
        try{window.opener.postMessage(msg,origin);return true;}catch(e1){
          try{window.opener.postMessage(msg,'*');return true;}catch(e2){}
        }
      }
      return false;
    }

    function expandSections(){
      var selectors=[
        'button.inline-show-more-text__button',
        'button.pv-profile-section__see-more-inline',
        'a.pv-profile-section__see-more-inline',
        'button[aria-label*="see more" i]',
        'button[aria-label*="Show more" i]',
        'button[aria-expanded="false"]'
      ];
      selectors.forEach(function(sel){
        document.querySelectorAll(sel).forEach(function(el){
          try{if(el&&el.click)el.click();}catch(e){}
        });
      });
    }

    async function scrapeFullProfileText(){
      if(path.indexOf('/in/')===-1){
        return '';
      }
      expandSections();
      var height=document.body?document.body.scrollHeight:0;
      for(var y=0;y<=height;y+=500){
        window.scrollTo(0,y);
        await new Promise(function(r){setTimeout(r,100);});
      }
      window.scrollTo(0,0);
      await new Promise(function(r){setTimeout(r,300);});
      expandSections();
      await new Promise(function(r){setTimeout(r,200);});
      var root=document.querySelector('main')
        ||document.querySelector('.scaffold-layout__main')
        ||document.querySelector('#profile-content')
        ||document.body;
      return (root&&root.innerText)?root.innerText.trim():'';
    }

    async function copyFullProfileFallback(text){
      try{
        if(navigator.clipboard&&navigator.clipboard.writeText){
          await navigator.clipboard.writeText(text);
          alert('Full profile copied ('+text.length.toLocaleString()+' chars). Paste it into LinkedIn Warrior.');
          return true;
        }
      }catch(e){}
      return false;
    }

    if(onLogin){
      send({source:src,type:'auth',signedIn:false,url:href,error:'Not signed in — complete LinkedIn login first.'});
      alert('Please sign in to LinkedIn first, then click Import profile again on your profile page.');
      return;
    }

    var text=await scrapeFullProfileText();
    if(text.length<200){
      alert('Could not read enough profile text. Open your full LinkedIn profile (/in/yourname), scroll to Experience, then try Import profile again.');
      return;
    }

    var payload={source:src,type:'profile',signedIn:true,url:href,text:text,fetchedAt:Date.now(),charCount:text.length};
    if(send(payload)){
      alert('Full profile sent ('+text.length.toLocaleString()+' chars) — switch back to LinkedIn Warrior.');
      return;
    }

    if(await copyFullProfileFallback(text)) return;
    alert('Profile captured ('+text.length.toLocaleString()+' chars) but could not reach LinkedIn Warrior. Keep the app tab open as a popup parent, or paste manually.');
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
    if (!data.text || data.text.length < MIN_PROFILE_TEXT_LENGTH) return null;
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
        charCount: payload.text?.length || 0,
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

/** Read all paste fields and return the longest non-empty value (full profile). */
export function getCombinedPastedProfileText() {
  const fieldIds = ['linkedin-paste-input', 'linkedin-auth-paste'];
  let longestText = '';
  for (const fieldId of fieldIds) {
    const value = document.getElementById(fieldId)?.value?.trim() || '';
    if (value.length > longestText.length) longestText = value;
  }
  return longestText;
}

export function syncPastedProfileFields(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;
  for (const fieldId of ['linkedin-paste-input', 'linkedin-auth-paste']) {
    const field = document.getElementById(fieldId);
    if (field && trimmed.length >= (field.value?.trim().length || 0)) {
      field.value = trimmed;
    }
  }
  const details = document.getElementById('linkedin-import-details');
  if (details) details.open = true;
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
 * Always listen for bookmarklet postMessage from linkedin.com (signed-in tab).
 * Caches imports even when the auth panel is closed.
 */
export function installLinkedInProfileMessageListener(handlers = {}) {
  if (window.__linkedinWarriorMessageListenerInstalled) {
    return () => {};
  }
  window.__linkedinWarriorMessageListenerInstalled = true;

  function onMessage(event) {
    if (!isLinkedInWarriorMessage(event)) return;
    if (!event.origin.includes('linkedin.com')) return;

    const { type, signedIn, text, url, error, charCount } = event.data;

    if (type === 'auth' || signedIn === false) {
      handlers.onAuthError?.(error || 'Not signed in to LinkedIn.');
      return;
    }

    if (type === 'profile' && text && text.length >= MIN_PROFILE_TEXT_LENGTH) {
      cacheProfileImport({ url: url || '', text, fetchedAt: Date.now() });
      syncPastedProfileFields(text);
      handlers.onProfileImported?.({
        text,
        url: url || '',
        charCount: charCount || text.length,
      });
    }
  }

  window.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener('message', onMessage);
    window.__linkedinWarriorMessageListenerInstalled = false;
  };
}

/**
 * Optional interactive import — never required for analysis.
 * User can: continue URL-only, paste text, or use bookmarklet postMessage.
 */
export function requestLinkedInProfileImport(profileUrl, uiHandlers = {}) {
  const cached = getCachedProfileImport(profileUrl);
  if (cached) {
    uiHandlers.onStatus?.(`Using imported profile (${cached.text.length.toLocaleString()} chars)…`);
    syncPastedProfileFields(cached.text);
    return Promise.resolve({
      signedIn: true,
      profileText: cached.text,
      url: cached.url || profileUrl,
      fromCache: true,
      urlOnly: false,
      charCount: cached.text.length,
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

      const { type, signedIn, text, url, error, charCount } = event.data;

      if (type === 'auth' || signedIn === false) {
        uiHandlers.onStatus?.(error || 'Not signed in on that tab — sign in or paste profile text below.');
        return;
      }

      if (type === 'profile' && text) {
        cacheProfileImport({ url: url || profileUrl, text, fetchedAt: Date.now() });
        syncPastedProfileFields(text);
        uiHandlers.onStatus?.(`Profile imported (${(charCount || text.length).toLocaleString()} chars).`);
        finish({
          signedIn: true,
          profileText: text,
          url: url || profileUrl,
          fromCache: false,
          urlOnly: false,
          charCount: charCount || text.length,
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
          charCount: 0,
        });
      },
      submitPastedText(text) {
        const trimmed = (text || getCombinedPastedProfileText() || '').trim();
        if (trimmed.length < MIN_PROFILE_TEXT_LENGTH) {
          uiHandlers.onStatus?.('Paste more profile text (headline, about, experience).');
          return false;
        }
        cacheProfileImport({ url: profileUrl, text: trimmed, fetchedAt: Date.now() });
        syncPastedProfileFields(trimmed);
        uiHandlers.onStatus?.(`Profile text saved (${trimmed.length.toLocaleString()} chars).`);
        finish({
          signedIn: true,
          profileText: trimmed,
          url: profileUrl,
          fromCache: false,
          urlOnly: false,
          charCount: trimmed.length,
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
    uiHandlers.onStatus?.('Signed in? Paste profile text, click Import profile on your LinkedIn tab, or continue with URL only.');
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
  const trimmed = (pastedText || getCombinedPastedProfileText() || '').trim();

  const candidates = [
    cached?.text ? { profileText: cached.text, source: 'cache' } : null,
    trimmed.length >= MIN_PROFILE_TEXT_LENGTH ? { profileText: trimmed, source: 'paste' } : null,
  ].filter(Boolean);

  if (!candidates.length) {
    return { profileText: '', source: 'url', charCount: 0 };
  }

  const best = candidates.reduce((longest, candidate) =>
    candidate.profileText.length > longest.profileText.length ? candidate : longest,
  );

  if (best.source === 'paste') {
    cacheProfileImport({ url: profileUrl, text: best.profileText, fetchedAt: Date.now() });
    syncPastedProfileFields(best.profileText);
  }

  return {
    profileText: best.profileText,
    source: best.source,
    charCount: best.profileText.length,
  };
}
