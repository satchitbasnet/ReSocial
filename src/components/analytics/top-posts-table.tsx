import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import type { PlatformId } from "@/lib/constants";

interface TopPost {
  postId: string;
  title: string;
  platform: string;
  views: number;
  engagementRate: number;
  likes: number;
}

interface TopPostsTableProps {
  posts: TopPost[];
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function TopPostsTable({ posts }: TopPostsTableProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        No published posts with metrics yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="pb-3 font-medium">Post</th>
            <th className="pb-3 font-medium">Platform</th>
            <th className="pb-3 font-medium text-right">Views</th>
            <th className="pb-3 font-medium text-right">Engagement</th>
            <th className="pb-3 font-medium text-right">Likes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {posts.map((post, i) => {
            const platform = PLATFORMS.find((p) => p.id === post.platform);
            return (
              <tr key={`${post.postId}-${post.platform}-${i}`}>
                <td className="py-3 pr-4">
                  <span className="font-medium text-gray-900 line-clamp-1 max-w-[200px]">
                    {post.title}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-1.5">
                    <PlatformIcon
                      platform={post.platform as PlatformId}
                      size={16}
                    />
                    <span className="text-gray-600">
                      {platform?.name ?? post.platform}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-right font-medium text-gray-900">
                  {formatViews(post.views)}
                </td>
                <td className="py-3 text-right text-brand-600 font-medium">
                  {post.engagementRate.toFixed(1)}%
                </td>
                <td className="py-3 text-right text-gray-600">
                  {formatViews(post.likes)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
