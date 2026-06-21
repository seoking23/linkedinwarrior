/**
 * wflow.js — One-click wizard flow for LinkedIn Warrior
 * Paste URL → accept review → consultation → Nano Banana photo → 10 posts
 */

const WIZARD_STEP_COUNT = 4;

export function createWizardFlow(deps) {
  let currentStep = 0;
  let pipelineRunning = false;
  let headshotPrompt = null;

  const {
    getElements,
    validateLinkedIn,
    normalizeLinkedIn,
    getApiBase,
    getGeminiKey,
    getProfileText,
    resolveProfileTextForAnalysis,
    analyzeLinkedIn,
    extractProfileData,
    generateContentPlan,
    generateImagePrompt,
    fetchGitHubProfile,
    apiPostWithFallback,
    saveSession,
    updateSession,
    setGithubToken,
    renderReview,
    renderConsultation,
    renderLinkedInProfile,
    renderPhotoStep,
    renderPostsStep,
    renderImagePrompts,
    showWizard,
    hideWizard,
    showDashboard,
    setProgress,
    markChipDone,
    delay,
  } = deps;

  function goToStep(step) {
    currentStep = step;
    const els = getElements();

    els.wizardPanels.forEach((panel, index) => {
      panel.classList.toggle('active', index + 1 === step);
    });

    els.wizardDots.forEach((dot, index) => {
      dot.classList.remove('active', 'done');
      if (index + 1 === step) dot.classList.add('active');
      else if (index + 1 < step) dot.classList.add('done');
    });

    updateSession({ wizardStep: step });
  }

  function showComplete() {
    const els = getElements();
    els.wizardPanels.forEach((panel) => panel.classList.remove('active'));
    els.wizardComplete.classList.add('active');
    els.wizardDots.forEach((dot) => {
      dot.classList.remove('active');
      dot.classList.add('done');
    });
    updateSession({ wizardComplete: true });
  }

  async function runPipeline(state) {
    if (pipelineRunning) return;
    pipelineRunning = true;

    const { linkedinUrl, githubUrl, githubToken } = state;

    try {
      let profileText = state.profileText || '';
      const pasted = getProfileText ? getProfileText() : '';
      const resolved = resolveProfileTextForAnalysis
        ? resolveProfileTextForAnalysis(linkedinUrl, pasted)
        : { profileText, source: 'url' };
      profileText = resolved.profileText;
      state.profileText = profileText;
      state.profileSource = resolved.source;

      if (resolved.source === 'cache') {
        setProgress(8, 'Using imported LinkedIn profile…', 'fetch');
      } else if (resolved.source === 'paste') {
        setProgress(8, 'Using pasted profile text…', 'fetch');
      } else {
        setProgress(8, 'Analyzing from profile URL…', 'fetch');
      }

      // ── Agent 1: Fetch ──────────────────────────────────────────────
      setProgress(12, 'Preparing profile data…', 'fetch');
      await delay(400);
      markChipDone('fetch');

      // ── Agent 2: Extract ────────────────────────────────────────────
      // Structures raw bookmarklet/paste text into typed ProfileData before analysis.
      setProgress(18, 'Extracting profile structure…', 'extract');
      if (profileText.length > 100 && !profileText.trim().startsWith('{')) {
        try {
          const extracted = await apiPostWithFallback(
            '/api/extract-profile',
            { linkedin_url: linkedinUrl, linkedin_text: profileText },
            () => extractProfileData(profileText, linkedinUrl),
          );
          state.profileText = JSON.stringify(extracted);
          profileText = state.profileText;
        } catch (e) {
          console.warn('wflow.js: extract agent failed, using raw text:', e.message);
        }
      }

      showDashboard?.();
      if (renderLinkedInProfile) {
        const displaySource = profileText.trim().startsWith('{') ? 'extract' : (state.profileSource || 'url');
        renderLinkedInProfile('linkedin-profile-card', profileText, linkedinUrl, displaySource);
      }

      markChipDone('extract');

      // ── Agent 3: Analyze ────────────────────────────────────────────
      setProgress(32, 'Running AI profile review…', 'analyze');
      const review = await apiPostWithFallback(
        '/api/analyze',
        { linkedin_url: linkedinUrl, linkedin_text: profileText },
        () => analyzeLinkedIn(linkedinUrl, profileText),
      );

      state.reviewData = review;
      renderReview(review);
      renderConsultation(review);
      updateSession({ linkedinUrl, profileText, review });
      markChipDone('analyze');
      setProgress(40, 'Building your 10-post schedule…', 'content');

      if (githubUrl) {
        setProgress(45, 'Enriching with GitHub…', 'content');
        try {
          if (githubToken) setGithubToken(githubToken);
          state.githubData = await fetchGitHubProfile(githubUrl, githubToken || null);
          updateSession({ github: state.githubData });
        } catch (githubError) {
          console.warn('wflow.js: GitHub fetch failed:', githubError.message);
          state.githubData = null;
        }
      }

      const plan = await apiPostWithFallback(
        '/api/content-plan',
        {
          linkedin_url: linkedinUrl,
          linkedin_text: profileText,
          github_username: state.githubData?.username || '',
          github_data: state.githubData || {},
        },
        () => generateContentPlan(linkedinUrl, profileText, state.githubData),
      );
      state.contentPlan = plan;
      renderPostsStep(plan, state.githubData);
      updateSession({ contentPlan: plan });
      markChipDone('content');

      setProgress(75, 'Crafting Nano Banana profile photo prompt…', 'images');
      const name = review?.name || extractNameFromUrl(linkedinUrl);
      const role = review?.sections?.headline?.feedback?.split('.')?.[0] || 'professional';

      const headshotRes = await apiPostWithFallback(
        '/api/image-prompt',
        { linkedin_text: profileText, name, role, style: 'professional headshot' },
        async () => ({ prompt: await generateImagePrompt(name, role, profileText, 'professional headshot') }),
      );
      const prompt = headshotRes.prompt;

      headshotPrompt = prompt;
      state.imagePrompts = [{ label: '4K Professional Headshot', prompt }];
      renderPhotoStep(name, prompt);

      const badgeRes = await apiPostWithFallback(
        '/api/image-prompt',
        { linkedin_text: profileText, name, role, style: 'gdg-badge' },
        async () => ({ prompt: await generateImagePrompt(name, role, profileText, 'gdg-badge') }),
      );
      state.imagePrompts.push({ label: 'GDG Hackathon Badge', prompt: badgeRes.prompt });
      renderImagePrompts(state.imagePrompts);
      updateSession({ imagePrompts: state.imagePrompts });
      markChipDone('images');
      setProgress(100, 'Ready for your review', 'images');
      showWizard();
      goToStep(1);

      setTimeout(() => {
        const els = getElements();
        els.progressSection.classList.remove('visible');
      }, 1500);
    } catch (error) {
      console.error('wflow.js: pipeline failed:', error);
      const els = getElements();
      const hint = getApiBase()
        ? ' Try again — if the backend is down, add a Gemini key in Settings to use client-side mode.'
        : ' Try again or verify your Gemini key in Settings.';
      els.reviewError.textContent = 'Analysis failed: ' + error.message + hint;
      els.reviewError.style.display = 'block';
      els.progressSection.classList.remove('visible');
    } finally {
      pipelineRunning = false;
    }
  }

  async function startConsultation() {
    const els = getElements();
    const rawUrl = els.linkedinUrlInput.value;
    const errMsg = validateLinkedIn(rawUrl);

    if (errMsg) {
      els.urlError.textContent = errMsg;
      els.urlError.style.display = 'block';
      els.linkedinUrlInput.classList.add('error');
      return;
    }

    els.urlError.style.display = 'none';
    els.linkedinUrlInput.classList.remove('error');

    const linkedinUrl = normalizeLinkedIn(rawUrl);
    const githubUrl = els.githubUrlInput?.value?.trim() || '';
    const githubToken = els.githubTokenInput?.value?.trim() || '';
    const profileText = getProfileText ? getProfileText() : '';

    const apiBase = getApiBase();
    const geminiKey = getGeminiKey();
    if (!apiBase && !geminiKey) {
      els.urlError.textContent = 'Add a Gemini API key in Settings to continue.';
      els.urlError.style.display = 'block';
      els.settingsPanel.classList.add('visible');
      return;
    }

    const state = {
      linkedinUrl,
      profileText,
      githubUrl,
      githubToken,
      reviewData: null,
      contentPlan: null,
      githubData: null,
      imagePrompts: null,
    };

    els.startBtn.disabled = true;
    els.startBtn.textContent = 'Starting…';
    els.progressSection.classList.add('visible');
    showDashboard();

    saveSession({
      linkedinUrl,
      profileText,
      github: null,
      wizardStep: 0,
      wizardComplete: false,
      postsAccepted: false,
    });

    await runPipeline(state);

    els.startBtn.disabled = false;
    els.startBtn.textContent = 'Start consultation →';
  }

  function acceptReview() {
    goToStep(2);
  }

  function acceptConsultation() {
    goToStep(3);
  }

  async function generateNanoBananaPhoto(copyPromptFn) {
    if (!headshotPrompt) return;
    await copyPromptFn(headshotPrompt);
    window.open('https://aistudio.google.com/app/prompts/new_chat', '_blank', 'noopener');
    goToStep(4);
  }

  function skipPhoto() {
    goToStep(4);
  }

  async function acceptAllPosts(copyAllPostsFn, posts) {
    await copyAllPostsFn(posts);
    updateSession({ postsAccepted: true, postsAcceptedAt: Date.now() });
    showComplete();
  }

  function viewFullReport() {
    hideWizard();
    const els = getElements();
    els.dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function restoreWizard(session) {
    if (session.wizardComplete) {
      showDashboard();
      return;
    }
    if (session.wizardStep && session.wizardStep > 0) {
      showWizard();
      goToStep(session.wizardStep);
    }
  }

  return {
    WIZARD_STEP_COUNT,
    startConsultation,
    acceptReview,
    acceptConsultation,
    generateNanoBananaPhoto,
    skipPhoto,
    acceptAllPosts,
    viewFullReport,
    restoreWizard,
    goToStep,
  };
}

function extractNameFromUrl(url) {
  try {
    const slug = url.split('/in/')[1]?.split('/')[0]?.split('?')[0] || '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return 'Professional';
  }
}
