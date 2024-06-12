import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { PackageJson } from '@npmcli/package-json';
import packageJsonModule from '@npmcli/package-json';

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
  { username: user, organization, token }: ListReposOptions,
  repos: object[],
  nextUrl: string
) => {
  try {
    const headers: HeadersInit = {};

    if (token) {
      const encodedToken = Buffer.from(
        `${user || organization}/token:${token}`
      ).toString('base64');

      headers.Authorization = `Basic ${encodedToken}`;
    }

    const url =
      nextUrl ??
      `https://api.github.com/${user ? 'users' : 'orgs'}/${user || organization}/repos`;

    console.dir(url);

    const result = await fetch(url, {
      headers
    });
    const parsed = await result.json();

    console.dir(parsed);

    if (result.headers.has('Link')) {
      console.log(`Recursing to next page ${result.headers.get('Link')}`);

      return fetchRepos(
        { username: user, organization, token },
        repos,
        result.headers.get('Link')
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

    await fetchRepos(opts, [], null);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
