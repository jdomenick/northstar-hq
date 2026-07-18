// Pure request builders for Facebook + Instagram publishing.
// These do NOT make HTTP calls; they return a description of what would be
// sent. Executed only from the job runner when a real connection exists.

export interface FbTextPostRequest {
  method: "POST";
  path: string; // /{page-id}/feed
  form: { message: string; link?: string; published?: string };
}

export interface FbPhotoPostRequest {
  method: "POST";
  path: string; // /{page-id}/photos
  form: { url?: string; caption?: string; message?: string; published?: string };
}

export interface FbMultiPhotoRequest {
  primary: { method: "POST"; path: string; form: { message: string; attached_media: string; published?: string } };
  uploads: Array<{ method: "POST"; path: string; form: { url: string; published: string } }>;
}

export interface IgSingleImageRequest {
  container: { method: "POST"; path: string; form: { image_url: string; caption?: string; alt_text?: string } };
  publish: { method: "POST"; path: string; form: { creation_id: string } };
}

export interface IgCarouselRequest {
  children: Array<{ method: "POST"; path: string; form: { image_url: string; is_carousel_item: "true" } }>;
  parent: { method: "POST"; path: string; form: { media_type: "CAROUSEL"; children: string; caption?: string } };
  publish: { method: "POST"; path: string; form: { creation_id: string } };
}

export function buildFbTextPost(pageId: string, message: string, link?: string): FbTextPostRequest {
  return {
    method: "POST",
    path: `/${pageId}/feed`,
    form: { message, ...(link ? { link } : {}) },
  };
}

export function buildFbPhotoPost(pageId: string, imageUrl: string, caption?: string): FbPhotoPostRequest {
  return {
    method: "POST",
    path: `/${pageId}/photos`,
    form: { url: imageUrl, ...(caption ? { caption } : {}) },
  };
}

export function buildFbMultiPhotoPost(pageId: string, imageUrls: string[], message: string): FbMultiPhotoRequest {
  const uploads = imageUrls.map((url) => ({
    method: "POST" as const,
    path: `/${pageId}/photos`,
    form: { url, published: "false" },
  }));
  return {
    uploads,
    primary: {
      method: "POST",
      path: `/${pageId}/feed`,
      form: {
        message,
        // caller substitutes attached_media with resolved IDs after uploads
        attached_media: "__ATTACHED_MEDIA_IDS__",
      },
    },
  };
}

export function buildIgSingleImage(igUserId: string, imageUrl: string, caption?: string, altText?: string): IgSingleImageRequest {
  return {
    container: {
      method: "POST",
      path: `/${igUserId}/media`,
      form: { image_url: imageUrl, ...(caption ? { caption } : {}), ...(altText ? { alt_text: altText } : {}) },
    },
    publish: {
      method: "POST",
      path: `/${igUserId}/media_publish`,
      form: { creation_id: "__CREATION_ID__" },
    },
  };
}

export function buildIgCarousel(igUserId: string, imageUrls: string[], caption?: string): IgCarouselRequest {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error("ig_carousel_child_count_out_of_range");
  }
  return {
    children: imageUrls.map((url) => ({
      method: "POST" as const,
      path: `/${igUserId}/media`,
      form: { image_url: url, is_carousel_item: "true" as const },
    })),
    parent: {
      method: "POST",
      path: `/${igUserId}/media`,
      form: { media_type: "CAROUSEL" as const, children: "__CHILDREN_IDS__", ...(caption ? { caption } : {}) },
    },
    publish: {
      method: "POST",
      path: `/${igUserId}/media_publish`,
      form: { creation_id: "__CREATION_ID__" },
    },
  };
}
