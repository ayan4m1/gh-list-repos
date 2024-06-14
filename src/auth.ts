import open from 'open';
import { join } from 'path';
import { homedir } from 'os';
import { readFile, writeFile } from 'fs/promises';
import { parse, stringify } from 'yaml';
import copyPaste from 'copy-paste';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { AuthData } from './utils.js';

const { copy } = copyPaste;
const configPath = join(homedir(), '.ghreporc.yml');
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

const encodeString = (input: string) => Buffer.from(input).toString('base64');

export const makeApiRequest = (
  url: string,
  { token, username, organization }: AuthData
): Promise<Response> =>
  fetch(url, {
    headers: {
      Authorization: `Basic ${encodeString(`${username ?? organization}/token:${token}`)}`
    }
  });

export const getCurrentUsername = async (authData: AuthData) => {
  const metaResult = await makeApiRequest(
    'https://api.github.com/user',
    authData
  );

  if (metaResult.status !== 200) {
    return null;
  }

  const { login } = await metaResult.json();

  return login as string;
};

export const authenticate = async (): Promise<AuthData> => {
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
    console.error(error);
    try {
      console.log('Attempting new login to GitHub to get token...');
      authData = await auth({ type: 'oauth' });
      await saveAuthData(authData);
    } catch {
      throw new Error('Failed to get auth data from GitHub!');
    }
  }

  return authData;
};
