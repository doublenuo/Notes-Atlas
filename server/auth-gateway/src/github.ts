import type { AppConfig } from './config.js';
import type { AuthDb, User } from './db.js';
import { GithubError, GithubLinkError } from './errors.js';
import { cleanNick, defaultNickFromGithub } from './nick.js';

interface GithubProfile {
  id: number;
  login: string;
  avatar_url?: string | null;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

interface GithubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'Notes-Atlas-Auth/1.0';

export class GithubClient {
  private readonly config: AppConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AppConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  get configured(): boolean {
    return Boolean(this.config.githubClientId && this.config.githubClientSecret);
  }

  authorizeUrl(state: string): string {
    if (!this.config.githubClientId) throw new GithubError('GitHub 登录未配置', 'github_not_configured');
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', this.config.githubClientId);
    url.searchParams.set('redirect_uri', this.config.githubCallbackUrl);
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);
    url.searchParams.set('allow_signup', 'true');
    return url.toString();
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const response = await this.fetchImpl(`${GITHUB_API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new GithubError(`GitHub API 请求失败（${response.status}）`);
    }
    return response.json();
  }

  async exchangeCode(code: string): Promise<string> {
    if (!this.config.githubClientId || !this.config.githubClientSecret) {
      throw new GithubError('GitHub 登录未配置', 'github_not_configured');
    }
    const response = await this.fetchImpl('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({
        client_id: this.config.githubClientId,
        client_secret: this.config.githubClientSecret,
        code,
        redirect_uri: this.config.githubCallbackUrl,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new GithubError('GitHub 授权失败，请重试');
    }
    const data = (await response.json()) as GithubTokenResponse;
    if (!data.access_token) {
      throw new GithubError(data.error_description || 'GitHub 授权失败，请重试');
    }
    return data.access_token;
  }

  async fetchProfile(token: string): Promise<GithubProfile> {
    const data = (await this.request('/user', {
      headers: { Authorization: `Bearer ${token}` },
    })) as Partial<GithubProfile>;
    if (typeof data.id !== 'number' || typeof data.login !== 'string') {
      throw new GithubError('无法读取 GitHub 用户信息');
    }
    return {
      id: data.id,
      login: data.login,
      avatar_url: typeof data.avatar_url === 'string' ? data.avatar_url : null,
    };
  }

  async fetchVerifiedEmail(token: string): Promise<string> {
    const data = (await this.request('/user/emails', {
      headers: { Authorization: `Bearer ${token}` },
    })) as unknown;
    if (!Array.isArray(data)) throw new GithubError('无法读取 GitHub 邮箱');
    const emails = data
      .filter((item): item is GithubEmail => {
        if (!item || typeof item !== 'object') return false;
        const value = item as Partial<GithubEmail>;
        return (
          typeof value.email === 'string' &&
          typeof value.primary === 'boolean' &&
          typeof value.verified === 'boolean'
        );
      })
      .filter((item) => item.verified);
    const preferred = emails.find((item) => item.primary) ?? emails[0];
    if (!preferred) {
      throw new GithubError('GitHub 账号没有已验证的邮箱', 'github_email_unverified');
    }
    return preferred.email.toLowerCase();
  }

  upsertUser(profile: GithubProfile, email: string, db: AuthDb, now: number): User {
    const githubId = String(profile.id);
    const avatarUrl =
      typeof profile.avatar_url === 'string' && profile.avatar_url.startsWith('https://')
        ? profile.avatar_url
        : null;

    const byGithub = db.findUserByGithubId(githubId);
    if (byGithub) {
      if (avatarUrl && byGithub.avatarUrl !== avatarUrl) {
        db.updateAvatar(byGithub.id, avatarUrl, now);
        return db.findUserById(byGithub.id) ?? byGithub;
      }
      return byGithub;
    }

    const byEmail = db.findUserByEmail(email);
    if (byEmail) {
      if (byEmail.githubId && byEmail.githubId !== githubId) {
        throw new GithubLinkError();
      }
      return db.linkGithub(byEmail.id, githubId, avatarUrl, now);
    }

    const nick = cleanNick(defaultNickFromGithub(profile.login)) || '读者';
    try {
      return db.createUser({
        email,
        nick,
        githubId,
        avatarUrl,
        now,
      });
    } catch {
      const raced = db.findUserByGithubId(githubId) ?? db.findUserByEmail(email);
      if (raced) return raced;
      throw new GithubError('创建 GitHub 用户失败');
    }
  }
}
