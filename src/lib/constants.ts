export const PLATFORMS = [
  { id: "tiktok", name: "TikTok", color: "#000000" },
  { id: "youtube", name: "YouTube", color: "#FF0000" },
  { id: "instagram", name: "Instagram", color: "#E4405F" },
  { id: "facebook", name: "Facebook", color: "#1877F2" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2" },
  { id: "twitter", name: "X (Twitter)", color: "#000000" },
  { id: "pinterest", name: "Pinterest", color: "#BD081C" },
  { id: "snapchat", name: "Snapchat", color: "#FFFC00" },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]["id"];

export const PLATFORM_CAPTION_LIMITS: Record<PlatformId, number> = {
  tiktok: 2200,
  youtube: 5000,
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  twitter: 280,
  pinterest: 500,
  snapchat: 250,
};

export const PLANS = {
  trial: {
    name: "Free Trial",
    price: 0,
    dailyPrice: 0,
    accountsPerPlatform: 1,
    videosPerMonth: 10,
    description: "14-day trial, 10 videos free",
  },
  starter: {
    name: "Starter",
    price: 35,
    yearlyPrice: 349,
    dailyPrice: 1.17,
    yearlyDailyPrice: 0.97,
    accountsPerPlatform: 3,
    videosPerMonth: 5000,
    description: "Perfect for solo creators and small businesses",
  },
  pro: {
    name: "Pro",
    price: 79,
    yearlyPrice: 790,
    dailyPrice: 2.63,
    yearlyDailyPrice: 2.19,
    accountsPerPlatform: 10,
    videosPerMonth: Infinity,
    description: "Best for growing teams and multiple brands",
  },
  agency: {
    name: "Agency",
    price: 179,
    yearlyPrice: 1790,
    dailyPrice: 5.97,
    yearlyDailyPrice: 4.97,
    accountsPerPlatform: 25,
    videosPerMonth: Infinity,
    description: "Designed for agencies managing multiple clients",
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const FEATURES = [
  {
    title: "Post once, reach everywhere",
    description:
      "Upload content once and automatically distribute it to TikTok, YouTube, Instagram, Facebook, LinkedIn, X, and more.",
    icon: "broadcast",
  },
  {
    title: "Automate your workflow",
    description:
      "Connect your social accounts, set up workflows, and let ReSocial handle distribution while you create.",
    icon: "workflow",
  },
  {
    title: "Auto-resize for each platform",
    description:
      "Videos are automatically resized and optimized for each platform's requirements — vertical, square, or landscape.",
    icon: "resize",
  },
  {
    title: "Schedule & plan ahead",
    description:
      "Plan your content calendar and schedule posts to go live at the perfect time on every platform.",
    icon: "calendar",
  },
  {
    title: "Remove watermarks",
    description:
      "Automatically strip platform watermarks when repurposing content across channels.",
    icon: "eraser",
  },
  {
    title: "Templates & branding",
    description:
      "Apply consistent templates and branding overlays to all your distributed content.",
    icon: "template",
  },
] as const;

export const TESTIMONIALS = [
  {
    name: "Doc Williams",
    role: "Founder of Brand Factory Inc",
    quote:
      "Without ReSocial, I would never have been able to grow my audience the way I have. It changed my entire workflow.",
    headline: "Grew my audience like never before",
  },
  {
    name: "Yong Pratt",
    role: "Content Repurposing Coach",
    quote:
      "Using ReSocial has literally changed my business and what I no longer have to do manually.",
    headline: "Stop working so hard!",
  },
  {
    name: "Joel Comm",
    role: "Author, Speaker, and Podcaster",
    quote:
      "It's simply the best tool I have EVER seen for repurposing my content. Get it. Do it. Now.",
    headline: "I was giddy when I discovered ReSocial!",
  },
] as const;

export const FAQ = [
  {
    q: "How does the free trial work?",
    a: "You get 14 days to use ReSocial. Within those 14 days, you can publish up to 10 videos to your connected social platforms — no credit card required.",
  },
  {
    q: "Which platforms do you support?",
    a: "We support TikTok, YouTube, Instagram, Facebook, LinkedIn, X (Twitter), Pinterest, and Snapchat — with more platforms coming soon.",
  },
  {
    q: "Can I connect multiple accounts per platform?",
    a: "Yes! Depending on your plan, you can connect up to 3, 10, or 25 accounts per social network.",
  },
  {
    q: "Do you resize videos automatically?",
    a: "Yes. ReSocial automatically resizes and optimizes your videos for each platform's aspect ratio and requirements.",
  },
] as const;
