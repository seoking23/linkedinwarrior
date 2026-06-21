/**
 * profile-view.js — Parse and render fetched LinkedIn profile data
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nameFromLinkedInUrl(linkedinUrl) {
  try {
    const slug = linkedinUrl.split('/in/')[1]?.split('/')[0]?.split('?')[0] || '';
    if (!slug) return 'LinkedIn Profile';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return 'LinkedIn Profile';
  }
}

const SOURCE_LABELS = {
  cache: 'Imported profile',
  paste: 'Pasted profile',
  url: 'Profile URL',
  extract: 'Structured profile',
};

export function parseProfileForDisplay(profileText, linkedinUrl) {
  const trimmed = (profileText || '').trim();
  let structured = null;

  if (trimmed.startsWith('{')) {
    try {
      structured = JSON.parse(trimmed);
    } catch (err) {
      console.warn('profile-view.js: JSON parse failed:', err.message);
    }
  }

  if (structured && (structured.name || structured.headline)) {
    return {
      kind: 'structured',
      name: structured.name || nameFromLinkedInUrl(linkedinUrl),
      headline: structured.headline || '',
      location: structured.location || '',
      about: structured.about || '',
      experience: Array.isArray(structured.experience) ? structured.experience : [],
      skills: Array.isArray(structured.skills) ? structured.skills : [],
      education: Array.isArray(structured.education) ? structured.education : [],
      certifications: Array.isArray(structured.certifications) ? structured.certifications : [],
      recommendationsCount: structured.recommendations_count ?? null,
      activitySummary: structured.activity_summary || '',
      connectionCount: structured.connection_count || '',
      linkedinUrl,
    };
  }

  if (trimmed.length >= 100) {
    return {
      kind: 'raw',
      name: nameFromLinkedInUrl(linkedinUrl),
      headline: '',
      location: '',
      about: trimmed.slice(0, 1200) + (trimmed.length > 1200 ? '…' : ''),
      experience: [],
      skills: [],
      education: [],
      certifications: [],
      recommendationsCount: null,
      activitySummary: '',
      connectionCount: '',
      rawText: trimmed,
      linkedinUrl,
    };
  }

  return {
    kind: 'url',
    name: nameFromLinkedInUrl(linkedinUrl),
    headline: 'Profile inferred from URL — paste profile text for full details',
    location: '',
    about: '',
    experience: [],
    skills: [],
    education: [],
    certifications: [],
    recommendationsCount: null,
    activitySummary: '',
    connectionCount: '',
    linkedinUrl,
  };
}

function renderExperienceList(experience) {
  if (!experience.length) return '';
  const items = experience.slice(0, 6).map((entry) => {
    const title = escapeHtml(entry.title || entry.role || 'Role');
    const company = escapeHtml(entry.company || entry.organization || '');
    const duration = escapeHtml(entry.duration || entry.dates || '');
    const description = escapeHtml(entry.description || '');
    return `
      <div class="li-profile-exp-item">
        <div class="li-profile-exp-title">${title}${company ? ` · ${company}` : ''}</div>
        ${duration ? `<div class="li-profile-exp-meta">${duration}</div>` : ''}
        ${description ? `<div class="li-profile-exp-desc">${description}</div>` : ''}
      </div>`;
  }).join('');
  return `<div class="li-profile-block"><div class="li-profile-block-label">Experience</div>${items}</div>`;
}

function renderSkillsChips(skills) {
  if (!skills.length) return '';
  const chips = skills.slice(0, 16).map((s) => `<span class="li-profile-skill">${escapeHtml(s)}</span>`).join('');
  return `<div class="li-profile-block"><div class="li-profile-block-label">Skills</div><div class="li-profile-skills">${chips}</div></div>`;
}

function renderEducationList(education) {
  if (!education.length) return '';
  const items = education.slice(0, 4).map((entry) => {
    const school = escapeHtml(entry.school || entry.institution || '');
    const degree = escapeHtml(entry.degree || '');
    const year = escapeHtml(entry.year || entry.dates || '');
    return `
      <div class="li-profile-edu-item">
        <div class="li-profile-exp-title">${school}</div>
        <div class="li-profile-exp-meta">${[degree, year].filter(Boolean).join(' · ')}</div>
      </div>`;
  }).join('');
  return `<div class="li-profile-block"><div class="li-profile-block-label">Education</div>${items}</div>`;
}

export function renderLinkedInProfile(container, profileText, linkedinUrl, source = 'url') {
  const root = typeof container === 'string' ? document.getElementById(container) : container;
  if (!root) return;

  const profile = parseProfileForDisplay(profileText, linkedinUrl);
  const sourceLabel = SOURCE_LABELS[source] || SOURCE_LABELS.url;
  const safeUrl = escapeHtml(linkedinUrl);
  const metaBits = [
    profile.location,
    profile.connectionCount,
    profile.recommendationsCount != null ? `${profile.recommendationsCount} recommendations` : '',
  ].filter(Boolean);

  let bodyHtml = '';

  if (profile.about) {
    bodyHtml += `
      <div class="li-profile-block">
        <div class="li-profile-block-label">About</div>
        <p class="li-profile-about">${escapeHtml(profile.about)}</p>
      </div>`;
  }

  bodyHtml += renderExperienceList(profile.experience);
  bodyHtml += renderSkillsChips(profile.skills);
  bodyHtml += renderEducationList(profile.education);

  if (profile.certifications?.length) {
    bodyHtml += `
      <div class="li-profile-block">
        <div class="li-profile-block-label">Certifications</div>
        <ul class="li-profile-cert-list">${profile.certifications.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
      </div>`;
  }

  if (profile.activitySummary) {
    bodyHtml += `
      <div class="li-profile-block">
        <div class="li-profile-block-label">Activity</div>
        <p class="li-profile-about">${escapeHtml(profile.activitySummary)}</p>
      </div>`;
  }

  if (profile.kind === 'url' && !bodyHtml) {
    bodyHtml = `
      <div class="li-profile-empty">
        No profile text was imported. Open your
        <a href="${safeUrl}" target="_blank" rel="noopener">LinkedIn profile</a>
        and paste the page text above the Analyze button for a full preview here.
      </div>`;
  }

  root.innerHTML = `
    <div class="li-profile-card">
      <div class="li-profile-banner"></div>
      <div class="li-profile-body">
        <div class="li-profile-avatar" aria-hidden="true">${escapeHtml(profile.name.charAt(0).toUpperCase())}</div>
        <div class="li-profile-head">
          <div class="li-profile-name">${escapeHtml(profile.name)}</div>
          ${profile.headline ? `<div class="li-profile-headline">${escapeHtml(profile.headline)}</div>` : ''}
          ${metaBits.length ? `<div class="li-profile-meta">${metaBits.map(escapeHtml).join(' · ')}</div>` : ''}
          <div class="li-profile-source-row">
            <span class="li-profile-source-badge">${escapeHtml(sourceLabel)}</span>
            <a class="li-profile-link" href="${safeUrl}" target="_blank" rel="noopener">View on LinkedIn ↗</a>
          </div>
        </div>
        ${bodyHtml}
      </div>
    </div>`;

  const section = document.getElementById('linkedin-profile-section');
  if (section) section.style.display = 'block';
}

export function hideLinkedInProfileSection() {
  const section = document.getElementById('linkedin-profile-section');
  if (section) section.style.display = 'none';
}
