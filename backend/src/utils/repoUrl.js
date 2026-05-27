export function normalizeGitHubUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw createBadRequest('A GitHub repository URL is required.');
  }

  const trimmed = rawUrl.trim();
  let url;

  try {
    url = new URL(trimmed);
  } catch {
    throw createBadRequest('Enter a valid GitHub repository URL.');
  }

  const host = url.hostname.toLowerCase();
  if (!['github.com', 'www.github.com'].includes(host)) {
    throw createBadRequest('Only github.com repository URLs are supported in Part 1.');
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw createBadRequest('Use an https://github.com/owner/repo URL.');
  }

  const parts = url.pathname
    .replace(/\.git$/i, '')
    .split('/')
    .filter(Boolean);

  if (parts.length < 2) {
    throw createBadRequest('GitHub URL must include both owner and repository name.');
  }

  const [owner, repo] = parts;
  const safeName = /^[A-Za-z0-9_.-]+$/;
  if (!safeName.test(owner) || !safeName.test(repo)) {
    throw createBadRequest('Repository owner or name contains unsupported characters.');
  }

  return {
    owner,
    repo,
    projectName: repo,
    htmlUrl: `https://github.com/${owner}/${repo}`,
    cloneUrl: `https://github.com/${owner}/${repo}.git`
  };
}

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  return error;
}

