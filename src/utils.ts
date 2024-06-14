import type { PackageJson } from '@npmcli/package-json';

import Table from 'cli-table';
import { fileURLToPath } from 'url';
import ansiColors from 'ansi-colors';
import { dirname, resolve } from 'path';
import { SingleBar } from 'cli-progress';
import parseLinkHeader from 'parse-link-header';
import packageJsonModule from '@npmcli/package-json';

import { authenticate, makeApiRequest } from './auth.js';
import { compareAsc, format, parseISO } from 'date-fns';

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
  progressBar: SingleBar,
  repos: GitHubRepoData[] = [],
  nextUrl: string = null
) => {
  try {
    const identifier = options.username ?? options.organization;
    const url =
      nextUrl ??
      `https://api.github.com/${options.username ? 'users' : 'orgs'}/${identifier}/repos?per_page=100`;

    const result = await makeApiRequest(url, options);
    const parsed = await result.json();

    if (!Array.isArray(parsed)) {
      throw new Error(`Invalid response from API: ${parsed.message}`);
    }

    repos.push(...parsed);

    if (
      result.headers.has('Link') &&
      repos.length < (options.limit ?? Infinity)
    ) {
      const linkHeader = parseLinkHeader(result.headers.get('Link'));

      // start progress bar if this is the first recursion
      if (repos.length === parsed.length && linkHeader.last) {
        const lastPageUrl = new URL(linkHeader.last?.url);
        const lastPage = parseInt(lastPageUrl.searchParams.get('page'), 10);

        if (!isNaN(lastPage)) {
          progressBar.start(lastPage, 1);
        }
      }

      // recurse if necessary
      if (linkHeader.next) {
        progressBar.increment();
        return fetchRepos(options, progressBar, repos, linkHeader.next.url);
      }
    }
  } catch (error) {
    console.error(error);
  }

  return repos;
};

export const getPackageInfo = async (): Promise<PackageJson> =>
  (await packageJsonModule.load(getPackageJsonPath()))?.content;

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
      throw new Error('A token is required to access private repos!');
    }

    const progressBar = new SingleBar({
      format: `[{percentage}%] ${ansiColors.greenBright('{bar}')} ({value} / {total} pages)`
    });
    const repos = await fetchRepos(
      {
        ...opts,
        username,
        organization,
        token
      },
      progressBar
    );
    progressBar.stop();

    const table = new Table({
      head: ['Repository', 'Owner', 'Created', 'Pushed', 'Archived', 'Private'],
      colWidths: [35, 15, 15, 15, 10, 10],
      colAligns: ['left', 'left', 'right', 'right', 'middle', 'middle']
    });

    repos.sort((a: GitHubRepoData, b: GitHubRepoData) =>
      compareAsc(parseISO(a.pushed_at), parseISO(b.pushed_at))
    );

    const tableCells = repos.map((repo: GitHubRepoData) => [
      repo.name,
      repo.owner?.login ?? 'Unknown',
      format(parseISO(repo.created_at), 'yyy-MM-dd'),
      format(parseISO(repo.pushed_at), 'yyyy-MM-dd'),
      repo.archived ? '✅' : '❌',
      repo.private ? '✅' : '❌'
    ]);

    table.push(...tableCells);

    console.log(table.toString());
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
