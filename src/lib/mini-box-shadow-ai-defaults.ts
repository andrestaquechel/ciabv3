import type { GifSelection } from "@/lib/mini-box";

/** Default content from `01.26 Mini Box - Shadow AI.pptx` */
export const SHADOW_AI_TOPIC = "Shadow AI";

export const SHADOW_AI_DEFAULT_GIFS = {
  welcome: {
    id: "shadow-welcome",
    url: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExaDZ1cmRkZXQ0MG5pemx2aWVkcmJrcWw4bzEydDZqNnpueDRzbDN0aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xUNda2IjllEdeeySZi/giphy.gif",
    previewUrl:
      "https://media0.giphy.com/media/xUNda2IjllEdeeySZi/200.gif",
    title: "Shadow AI welcome",
    query: "shadow AI security",
  } satisfies NonNullable<GifSelection>,
  onePager: {
    id: "shadow-onepager",
    url: "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDEyM2NkdzZ4eW0xYWlwNjUzZ2VhYjJ3ODJmZHdpdmZzYXRnbzhlOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ov9k7I2V2TsliAorS/giphy.gif",
    previewUrl:
      "https://media1.giphy.com/media/3ov9k7I2V2TsliAorS/200.gif",
    title: "Shadow AI one-pager",
    query: "shadow AI cybersecurity",
  } satisfies NonNullable<GifSelection>,
  chat: {
    id: "shadow-chat",
    url: "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExNDNkNGVma2p1cmFycGJtcnEzdTFxc2U5bnc5eG5zdnc1MjVhNWJicCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Rl50aGkhP8FlrGaU4R/giphy.gif",
    previewUrl:
      "https://media4.giphy.com/media/Rl50aGkhP8FlrGaU4R/200.gif",
    title: "Shadow AI chat",
    query: "AI security chat",
  } satisfies NonNullable<GifSelection>,
};

export const SHADOW_AI_SECTION_DEFAULTS = {
  title: {
    topicTitle: SHADOW_AI_TOPIC,
  },
  welcome: {
    intro:
      "Welcome to your Mini Box on Shadow AI. Unapproved usage of AI programs, plugins, and other tools can cause security risks. Help your users understand why it's so important for IT to have visibility into their AI usage!",
    contents: `In this topical mini box, you'll find:
A one-pager that explains what Shadow AI is and why it's so important to prevent. We've provided a subject line for email distribution, but feel free to distribute this through the most appropriate channel for your organization.
A chat message explaining why IT needs to keep a particularly close eye on AI tools. Depending on your messaging client, you may need to save the provided GIFs to your computer and attach them to your chat messages.`,
    closing: `You are absolutely free to edit and customize the content we send. Make this Mini Box your own! Please don't hesitate to let us know if there's something you would like to see in the future.

The Living Security Team`,
    gif: SHADOW_AI_DEFAULT_GIFS.welcome,
  },
  onePager: {
    greeting: "Hey, Team!",
    subjectLine: "Subject:  👤 When AI casts a shadow…",
    bodyPart1: `There's no question that AI has changed the world…but it's yet to be seen precisely how. Organizations across the world have raced to adopt all kinds of AI tools in order to boost productivity and stay on the cutting edge of the way we work. The spread of AI has been so fast, in fact, that regulators and policy-makers (both at the governmental and organizational level) haven't been able to keep up. As these tools evolve and develop, they're left continually having to rewrite the rules on things like what training data can be fed to an AI system, what protected information organizations are allowed to process using AI, and what actions and decisions organizations are allowed to offload to AI.
Needless to say, the IT and security teams are putting a lot of energy and vigilance into both staying informed and keeping our organization in line with the most current regulations and recommendations. In order to do this, we need to maintain oversight over what AI tools are being used, who is using them, and what data is being shared with them. Changes in policy may require detailed auditing of what sensitive data our AI tools have collected or processed…and Shadow AI prevents us from accessing this crucial information.`,
    callout:
      "Shadow AI is the use of unapproved AI tools, including programs, models, plugins, SaaS features - anything AI-enabled. These unapproved tools create pockets of sensitive data that  cannot be reviewed, logged, permissioned, or deleted by the IT or security",
    bodyPart2: `teams. This is both a security issue and a legal issue, so it's very important to prevent the practice of Shadow AI within our organization. Never use any AI tool or feature that has not been pre-approved by IT. If you're not sure. Ask.
If you aren't sure whether the AI you've been using is approved (or know that it hasn't been), please let the security team know immediately so we can help you correct the issue. We're here to help, not get anyone in trouble! Thanks for all your hard work keeping our organization secure.`,
    gif: SHADOW_AI_DEFAULT_GIFS.onePager,
  },
  chat: {
    message: `A lot of people within our organization use the same AI tools, which means a lot of people are feeding it data that we're responsible for protecting. This unintentionally turns our AI into super users that have much more access and information than we'd normally grant to a human. This makes them powerful tools, but it also carries a proportionate amount of risk. 🦸🤖 If a cybercriminal got their hands into one of our AI systems, the damage they could do is much larger than if they gained access to a human's accounts.
For this reason, Security keeps a keen eye on our AI. 👁️🔐 When users practice Shadow AI - or the use of unapproved AI tools or features - it results in a super-user without any of the additional security measures to balance out that risk. Help our organization stay secure by always checking to make sure an AI tool or feature is approved by IT before making use of it!`,
    gif: SHADOW_AI_DEFAULT_GIFS.chat,
  },
};
