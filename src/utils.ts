import type { PackageJson } from '@npmcli/package-json';

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import parseLinkHeader from 'parse-link-header';
import packageJsonModule from '@npmcli/package-json';

import { authenticate, makeApiRequest } from './auth.js';

export enum Visibility {
  Public,
  Private,
  All
}

export enum SortField {
  Id,
  Name,
  FullName,
  OwnerName,
  CreatedAt,
  UpdatedAt,
  PushedAt,
  Stars,
  Watchers,
  Forks,
  OpenIssues,
  License,
  AllowsForks,
  IsTemplate
}

export enum SortDirection {
  Ascending,
  Descending
}

export type AuthData = {
  username?: string;
  organization?: string;
  token?: string;
};

export type GitHubRepoOwner = {
  login: string;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
};

export type GitHubRepoData = {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubRepoOwner;
  html_url: string;
  description?: string;
  fork: boolean;
  url: string;
  forks_url: string;
  keys_url: string;
  collaborators_url: string;
  teams_url: string;
  hooks_url: string;
  issue_events_url: string;
  events_url: string;
  assignees_url: string;
  branches_url: string;
  tags_url: string;
  blobs_url: string;
  git_tags_url: string;
  git_refs_url: string;
  trees_url: string;
  statuses_url: string;
  languages_url: string;
  stargazers_url: string;
  contributors_url: string;
  // todo: so many damn URLs...
  created_at: string;
  updated_at: string;
  pushed_at: string;
  git_url: string;
  ssh_url: string;
  clone_url: string;
  svn_url: string;
  homepage?: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language?: string;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
  forks_count: number;
  mirror_url?: string;
  archived: boolean;
  disabled: boolean;
  open_issues_count?: number;
  allow_forking: boolean;
  is_template: boolean;
  web_commit_signoff_required: boolean;
  topics: string[];
  visibility: string;
  forks: number;
  open_issues?: number;
  watchers: number;
  default_branch: string;
};

export type ListReposOptions = AuthData & {
  visibility?: Visibility;
  name?: string;
  skip?: number;
  limit?: number;
  sort?: {
    field: SortField;
    direction: SortDirection;
  };
};

const getInstallDirectory = (): string =>
  dirname(fileURLToPath(import.meta.url));

const getPackageJsonPath = (): string => resolve(getInstallDirectory(), '..');

export const fetchRepos = async (
  options: ListReposOptions,
  repos: object[],
  nextUrl: string
) => {
  try {
    const identifier = options.username ?? options.organization;
    const url =
      nextUrl ??
      `https://api.github.com/${options.username ? 'users' : 'orgs'}/${identifier}/repos`;

    const result = await makeApiRequest(url, options);
    const parsed = await result.json();

    repos.push(...parsed);

    console.log(`Added ${parsed.length} repos from this page`);

    if (result.headers.has('Link')) {
      const nextUrl = parseLinkHeader(result.headers.get('Link'))?.next?.url;

      if (!nextUrl) {
        return repos;
      }

      console.log(`Requesting page ${nextUrl}`);

      return fetchRepos(options, repos, nextUrl);
    }
  } catch (error) {
    console.error(error);
  }

  return repos;
};

export const getPackageInfo = async (): Promise<PackageJson> =>
  (await packageJsonModule.load(getPackageJsonPath())).content;

export async function listRepos(opts: ListReposOptions): Promise<void> {
  try {
    if (!opts) {
      throw new Error('Invalid options supplied!');
    }

    const { visibility } = opts;
    let { username, organization, token } = opts;

    if (username && organization) {
      throw new Error('User and organization cannot both be supplied!');
    } else if (!username && !organization) {
      throw new Error('Either user or organization must be supplied!');
    }

    if (!token) {
      const authData = await authenticate();

      username = authData.username;
      organization = authData.organization;
      token = authData.token;
    }

    if (!token && visibility !== Visibility.Public) {
      throw new Error('A token is required to obtain private repos!');
    }

    const repos = await fetchRepos(opts, [], null);

    console.dir(repos);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
