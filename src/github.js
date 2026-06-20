/**
 * github.js — GitHub public API fetch (no auth required for public profiles)
 * GitHub's public API: 60 requests/hour unauthenticated — plenty for demo day.
 */

export function parseGitHubUsername(input) {
  if (!input) return null;
  const trimmed = input.trim().replace(/\/$/, "");
  if (trimmed.includes("github.com/")) {
    return trimmed.split("github.com/")[1].split("/")[0];
  }
  // Plain username
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

export async function fetchGitHubProfile(usernameOrUrl, token = null) {
  const username = parseGitHubUsername(usernameOrUrl);
  if (!username) throw new Error("Invalid GitHub URL or username");

  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const [profileRes, reposRes] = await Promise.allSettled([
    fetch(`https://api.github.com/users/${username}`, { headers }),
    fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=20`, { headers }),
  ]);

  if (profileRes.status === "rejected" || !profileRes.value.ok) {
    const status = profileRes.value?.status;
    if (status === 404) throw new Error("GitHub profile not found. Check the URL and try again.");
    if (status === 401) throw new Error("Token looks invalid. Continuing with public profile only.");
    if (status === 403 || status === 429) throw new Error("GitHub rate limit hit. Using public data only.");
    throw new Error("GitHub fetch failed. Continuing with LinkedIn data.");
  }

  const profile = await profileRes.value.json();

  let repos = [];
  if (reposRes.status === "fulfilled" && reposRes.value.ok) {
    repos = await reposRes.value.json();
  }

  // Tally languages
  const languages = {};
  repos.forEach((r) => {
    if (r.language) languages[r.language] = (languages[r.language] || 0) + 1;
  });

  // Sort by stars for top repos
  const topRepos = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5)
    .map((r) => ({
      name: r.name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      url: r.html_url,
      last_updated: r.updated_at?.split("T")[0],
    }));

  return {
    username,
    profile_url: `https://github.com/${username}`,
    name: profile.name,
    bio: profile.bio,
    location: profile.location,
    avatar_url: profile.avatar_url,
    followers: profile.followers,
    following: profile.following,
    public_repos: profile.public_repos,
    account_created: profile.created_at?.split("T")[0],
    top_repos: topRepos,
    languages,
    blog: profile.blog || null,
    twitter: profile.twitter_username || null,
  };
}
