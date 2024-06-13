import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { PackageJson } from '@npmcli/package-json';
import packageJsonModule from '@npmcli/package-json';
import parseLinkHeader from 'parse-link-header';

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

export type Identification = {
  username?: string;
  organization?: string;
  token?: string;
};

export type ListReposOptions = Identification & {
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
  { username, organization, token }: ListReposOptions,
  repos: object[],
  nextUrl: string
) => {
  try {
    const headers: HeadersInit = {};

    if (token) {
      const encodedToken = Buffer.from(
        `${username || organization}/token:${token}`
      ).toString('base64');

      headers.Authorization = `Basic ${encodedToken}`;
    }

    const url =
      nextUrl ??
      `https://api.github.com/${username ? 'users' : 'orgs'}/${username ?? organization}/repos`;

    const result = await fetch(url, {
      headers
    });
    const parsed = await result.json();

    repos.push(...parsed);

    if (result.headers.has('Link')) {
      const nextUrl = parseLinkHeader(result.headers.get('Link'))?.next?.url;

      if (!nextUrl) {
        return repos;
      }

      console.log(`Recursing to next page ${nextUrl}`);

      return fetchRepos(
        { username: username, organization, token },
        repos,
        nextUrl
      );
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

    const { username: user, organization } = opts;

    if (user && organization) {
      throw new Error('User and organization cannot both be supplied!');
    }

    const repos = await fetchRepos(opts, [], null);

    console.dir(repos);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
