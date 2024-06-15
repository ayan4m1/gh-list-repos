import type { AuthData } from './utils.js';

const encodeString = (input: string) => Buffer.from(input).toString('base64');

export type GitHubRepoOwner = {
  login: string;
  // id: number;
  // node_id: string;
  // avatar_url: string;
  // gravatar_id: string;
  // url: string;
  // html_url: string;
  // followers_url: string;
  // following_url: string;
  // gists_url: string;
  // starred_url: string;
  // subscriptions_url: string;
  // organizations_url: string;
  // repos_url: string;
  // events_url: string;
  // received_events_url: string;
  // type: string;
  // site_admin: boolean;
};

export type GitHubUser = GitHubRepoOwner & {
  name?: string;
  // company?: string;
  // blog?: string;
  // location?: string;
  email?: string;
  // hireable: boolean;
  // bio?: string;
  // twitter_username?: string;
  // public_repos: number;
  // public_gists: number;
  // followers: number;
  // following: number;
};

export type GitHubRepoData = {
  id: number;
  // node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubRepoOwner;
  // html_url: string;
  // description?: string;
  fork: boolean;
  url: string;
  // forks_url: string;
  // keys_url: string;
  // collaborators_url: string;
  // teams_url: string;
  // hooks_url: string;
  // issue_events_url: string;
  // events_url: string;
  // assignees_url: string;
  // branches_url: string;
  // tags_url: string;
  // blobs_url: string;
  // git_tags_url: string;
  // git_refs_url: string;
  // trees_url: string;
  // statuses_url: string;
  // languages_url: string;
  // stargazers_url: string;
  // contributors_url: string;
  // todo: so many damn URLs...
  created_at: string;
  updated_at: string;
  pushed_at: string;
  // git_url: string;
  // ssh_url: string;
  // clone_url: string;
  // svn_url: string;
  // homepage?: string;
  // size: number;
  stargazers_count: number;
  watchers_count: number;
  // language?: string;
  // has_issues: boolean;
  // has_projects: boolean;
  // has_downloads: boolean;
  // has_wiki: boolean;
  // has_pages: boolean;
  // has_discussions: boolean;
  forks_count: number;
  // mirror_url?: string;
  archived: boolean;
  // disabled: boolean;
  open_issues_count?: number;
  allow_forking: boolean;
  is_template: boolean;
  // web_commit_signoff_required: boolean;
  // topics: string[];
  visibility: string;
  // forks: number;
  // open_issues?: number;
  // watchers: number;
  default_branch: string;
};

export async function makeRawApiRequest(
  url: string,
  authData?: AuthData
): Promise<Response> {
  const headers: HeadersInit = {};

  if (authData) {
    const { token, username, organization } = authData;

    headers['Authorization'] =
      `Basic ${encodeString(`${username ?? organization}/token:${token}`)}`;
  }

  const result = await fetch(url, { headers });

  if (result.status !== 200) {
    throw new Error(await result.text());
  }

  return result;
}

export async function makeApiRequest<T>(
  url: string,
  authData?: AuthData
): Promise<T> {
  const result = await makeRawApiRequest(url, authData);
  const parsed = await result.json();
  const converted = parsed as T;

  if (!converted) {
    throw new Error('Failed to convert response to proper type!');
  }

  return converted;
}

export async function getCurrentUsername(authData: AuthData) {
  const { login } = await makeApiRequest<GitHubUser>(
    'https://api.github.com/user',
    authData
  );

  return login;
}
