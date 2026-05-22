type FacebookCommentReplyInput = {
  commentId: string;
  message: string;
};

type CommentWebhookChange = {
  field?: string;
  value?: {
    item?: string;
    verb?: string;
    comment_id?: string;
    parent_id?: string;
    post_id?: string;
    message?: string;
    from?: {
      id?: string;
      name?: string;
    };
  };
};

type CommentWebhookEntry = {
  id?: string;
  changes?: CommentWebhookChange[];
};

type CommentWebhookBody = {
  object?: string;
  entry?: CommentWebhookEntry[];
};

type ExtractedCommentEvent = {
  pageId?: string;
  commentId: string;
  postId?: string;
  message: string;
  authorId?: string;
};

function cleanText(text: string) {
  return text.trim().replace(/[ \t]{2,}/g, ' ');
}

export function extractCommentEvent(body: CommentWebhookBody): ExtractedCommentEvent | null {
  const entries = Array.isArray(body?.entry) ? body.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      const isCommentChange =
        change?.field === 'feed' &&
        value?.item === 'comment' &&
        Boolean(value?.comment_id);

      if (!isCommentChange) continue;

      const message = cleanText(value?.message || '');
      if (!message) continue;

      if (entry.id && value?.from?.id && entry.id === value.from.id) {
        continue;
      }

      return {
        pageId: entry.id,
        commentId: value.comment_id as string,
        postId: value.post_id,
        message,
        authorId: value.from?.id,
      };
    }
  }

  return null;
}

export async function sendFacebookCommentReply({ commentId, message }: FacebookCommentReplyInput) {
  const config = useRuntimeConfig();
  const token = config.FACEBOOK_PAGE_TOKEN;
  if (!token) {
    throw new Error('FACEBOOK_PAGE_TOKEN is missing');
  }

  return await $fetch(`https://graph.facebook.com/v19.0/${commentId}/comments`, {
    method: 'POST',
    body: {
      message,
      access_token: token,
    },
    timeout: 10000,
  });
}
