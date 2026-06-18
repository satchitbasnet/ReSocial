import { createHash, randomBytes } from "crypto";
import { getAppUrl } from "@/lib/config";
import { fetchMediaBuffer } from "@/lib/r2";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API = "https://api.linkedin.com/v2";

const LINKEDIN_SCOPES = [
  "w_member_social",
  "r_basicprofile",
  "r_organization_social",
].join(" ");

export interface LinkedInTokens {
  accessToken: string;
  expiresIn: number;
}

export interface LinkedInProfileInfo {
  memberId: string;
  displayName: string;
}

export interface LinkedInVideoStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
}

export type TokenRefreshHandler = (
  accessToken: string,
  refreshToken: string
) => Promise<void>;

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

class LinkedInApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "LinkedInApiError";
  }
}

function getLinkedInCredentials() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export function getLinkedInRedirectUri(): string {
  return `${getAppUrl()}/api/auth/callback/linkedin`;
}

export function generatePkce(): PkcePair {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildLinkedInAuthUrl(state: string, codeChallenge: string): string {
  const { clientId } = getLinkedInCredentials();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getLinkedInRedirectUri(),
    state,
    scope: LINKEDIN_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export async function exchangeLinkedInCode(
  code: string,
  codeVerifier: string
): Promise<LinkedInTokens> {
  const { clientId, clientSecret } = getLinkedInCredentials();
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getLinkedInRedirectUri(),
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error_description || "LinkedIn token exchange failed");
  }

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in,
  };
}

async function linkedInFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
      ...options.headers,
    },
  });
}

export async function fetchLinkedInProfile(
  accessToken: string
): Promise<LinkedInProfileInfo> {
  const res = await linkedInFetch(
    `${LINKEDIN_API}/me?projection=(id,localizedFirstName,localizedLastName)`,
    accessToken
  );
  const body = await res.json();

  if (res.status === 401) {
    throw new LinkedInApiError("LinkedIn access token expired", 401);
  }
  if (!res.ok) {
    throw new Error(body.message || "Failed to fetch LinkedIn profile");
  }

  const first = body.localizedFirstName ?? "";
  const last = body.localizedLastName ?? "";
  return {
    memberId: body.id,
    displayName: `${first} ${last}`.trim() || "LinkedIn User",
  };
}

export async function publishVideoToLinkedIn(
  accessToken: string,
  mediaUrl: string,
  caption: string
): Promise<{ platformPostId: string; stats?: LinkedInVideoStats }> {
  const videoBuffer = await fetchMediaBuffer(mediaUrl);
  if (videoBuffer.length === 0) {
    throw new Error("Video file is empty");
  }

  const initRes = await linkedInFetch(
    "https://api.linkedin.com/rest/videos?action=initializeUpload",
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "LinkedIn-Version": "202401",
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: `urn:li:person:${(await fetchLinkedInProfile(accessToken)).memberId}`,
          fileSizeBytes: videoBuffer.length,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      }),
    }
  );

  const initBody = await initRes.json();
  if (!initRes.ok) {
    throw new Error(
      initBody.message || "LinkedIn video upload initialization failed"
    );
  }

  const uploadUrl =
    initBody.value?.uploadInstructions?.[0]?.uploadUrl ??
    initBody.value?.uploadUrl;
  const videoUrn = initBody.value?.video;

  if (!uploadUrl || !videoUrn) {
    throw new Error("LinkedIn did not return upload URL");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Uint8Array(videoBuffer),
  });

  if (!uploadRes.ok) {
    throw new Error(`LinkedIn video upload failed: ${uploadRes.status}`);
  }

  const profile = await fetchLinkedInProfile(accessToken);
  const postRes = await linkedInFetch(`${LINKEDIN_API}/ugcPosts`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      author: `urn:li:person:${profile.memberId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: caption.slice(0, 3000) },
          shareMediaCategory: "VIDEO",
          media: [
            {
              status: "READY",
              media: videoUrn,
            },
          ],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  const postBody = await postRes.json();
  if (!postRes.ok) {
    throw new Error(postBody.message || "LinkedIn post creation failed");
  }

  const platformPostId = postBody.id ?? videoUrn;
  return {
    platformPostId,
    stats: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagementRate: 0 },
  };
}
