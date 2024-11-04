import type { PackageJson } from '@npmcli/package-json';

import open from 'open';
import { join } from 'path';
import { homedir } from 'os';
import Table from 'cli-table';
import copyPaste from 'copy-paste';
import { fileURLToPath } from 'url';
import ansiColors from 'ansi-colors';
import { dirname, resolve } from 'path';
import { parse, stringify } from 'yaml';
import { SingleBar } from 'cli-progress';
import parseLinkHeader from 'parse-link-header';
import { readFile, writeFile } from 'fs/promises';
import packageJsonModule from '@npmcli/package-json';
import { compareAsc, format, parseISO } from 'date-fns';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';

import {
  GitHubRepoData,
  getCurrentUsername,
  makeRawApiRequest
} from './github.js';

const { copy } = copyPaste;

export enum IdentifierType {
  User = 'user',
  Organization = 'org'
}

export enum Visibility {
  Public = 'public',
  Private = 'private',
  All = 'all'
}

export enum SortField {
  Id = 'id',
  Name = 'name',
  FullName = 'full_name',
  OwnerName = 'owner.login',
  CreatedAt = 'created_at',
  UpdatedAt = 'updated_at',
  PushedAt = 'pushed_at',
  Stars = 'stargazers_count',
  Watchers = 'watchers_count',
  Forks = 'forks_count',
  OpenIssues = 'open_issues_count',
  AllowsForks = 'allow_forking',
  IsTemplate = 'is_template'
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

export type ListReposOptions = {
  name?: string;
  owner?: string;
  limit?: number;
  visibility?: Visibility;
  listSortFields: boolean;
  sort?: {
    field: SortField;
    direction: SortDirection;
  };
};

const configPath = join(homedir(), '.ghreporc.yml');

const getInstallDirectory = (): string =>
  dirname(fileURLToPath(import.meta.url));

const getPackageJsonPath = (): string => resolve(getInstallDirectory(), '..');

const saveAuthData = (data: AuthData) =>
  writeFile(
    configPath,
    stringify({
      data
    })
  );

const loadAuthData = async (): Promise<AuthData> =>
  parse(
    await readFile(configPath, {
      encoding: 'utf8'
    })
  );

const authenticate = async (): Promise<AuthData> => {
  let authData: AuthData = null;
  try {
    console.log(`Trying to load cached token from ${configPath}...`);
    authData = await loadAuthData();
    const authResult = await getCurrentUsername(authData);
    if (!authResult) {
      throw new Error('Failed to login using saved token!');
    } else {
      console.log(`Authenticated successfully as ${authResult}`);
    }
  } catch (error) {
    try {
      console.log('Attempting new login to GitHub to get token...');
      const auth = createOAuthDeviceAuth({
        clientType: 'oauth-app',
        clientId: 'Ov23lihrjpuE0czcBGvD',
        scopes: ['repo'],
        onVerification: async (info) => {
          console.log(
            'Navigate to the following URL in your browser: %s',
            info.verification_uri
          );
          console.log(
            'Then, paste this code (which has been copied into your clipboard automatically) and click Continue: %s',
            info.user_code
          );
          await open(info.verification_uri);
          copy(info.user_code);
        }
      });
      authData = await auth({ type: 'oauth' });
      await saveAuthData(authData);
    } catch {
      console.error(error);
      throw new Error('Failed to get auth data from GitHub!');
    }
  }

  return authData;
};

export const fetchRepos = async (
  options: ListReposOptions,
  progressBar: SingleBar,
  authData?: AuthData,
  repos: GitHubRepoData[] = [],
  nextUrl: string = null
): Promise<GitHubRepoData[]> => {
  try {
    const url =
      nextUrl ??
      `https://api.github.com/user/repos?visibility=${options.visibility}&per_page=100`;
    const result = await makeRawApiRequest(url, authData);
    const data = await result.json();

    if (!Array.isArray(data)) {
      throw new Error(`Invalid response from API!`);
    }

    // add response data to return result
    repos.push(...data);

    if (
      result.headers.has('Link') &&
      repos.length < (options.limit ?? Infinity)
    ) {
      const linkHeader = parseLinkHeader(result.headers.get('Link'));

      // start progress bar if this is the first recursion
      if (repos.length === data.length && linkHeader.last) {
        const lastPageUrl = new URL(linkHeader.last?.url);
        const lastPage = parseInt(lastPageUrl.searchParams.get('page'), 10);

        if (!isNaN(lastPage)) {
          progressBar.start(lastPage, 1);
        }
      }

      // increment progress bar and recurse if necessary
      if (linkHeader.next) {
        progressBar.increment();
        return fetchRepos(
          options,
          progressBar,
          authData,
          repos,
          linkHeader.next.url
        );
      }
    }
  } catch (error) {
    console.error(error);
  }

  return repos;
};

export const getPackageInfo = async (): Promise<PackageJson> =>
  (await packageJsonModule.load(getPackageJsonPath()))?.content;

export async function listRepos(options: ListReposOptions): Promise<void> {
  try {
    if (!options) {
      throw new Error('Invalid options supplied!');
    }

    const { listSortFields } = options;

    if (listSortFields) {
      console.log('Keys for sort fields:');
      for (const [key] of Object.entries(SortField)) {
        console.log(` * ${key}`);
      }
      return process.exit(0);
    }

    const authData: AuthData = await authenticate();
    const progressBar = new SingleBar({
      format: `[{percentage}%] ${ansiColors.greenBright('{bar}')} ({value} / {total} pages)`
    });
    let repos = await fetchRepos(options, progressBar, authData);

    if (options.name) {
      repos = repos.filter((repo) => repo.name.includes(options.name));
    }

    if (options.owner) {
      repos = repos.filter((repo) => repo.owner.login === options.owner);
    }
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
