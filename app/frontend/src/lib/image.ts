import { client } from '@/lib/api';

const BUCKET_NAME = 'product-images';

/**
 * Resolve an image_url field to a displayable URL.
 * - If it starts with http(s), return as-is (external URL or CDN).
 * - Otherwise, treat it as an object_key and get a download URL from storage.
 */
export async function resolveImageUrl(imageUrl: string | undefined | null): Promise<string | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  // It's an object_key - get download URL
  try {
    const res = await client.storage.getDownloadUrl({
      bucket_name: BUCKET_NAME,
      object_key: imageUrl,
    });
    return res?.data?.download_url || null;
  } catch (err) {
    console.error('Failed to resolve image URL:', err);
    return null;
  }
}

/**
 * Upload a file to product-images bucket and return the object_key.
 */
export async function uploadProductImage(file: File): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const objectKey = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    
    // Get upload URL
    const uploadRes = await client.storage.getUploadUrl({
      bucket_name: BUCKET_NAME,
      object_key: objectKey,
    });
    
    const uploadUrl = uploadRes?.data?.upload_url;
    if (!uploadUrl) {
      throw new Error('Failed to get upload URL');
    }
    
    // Upload the file
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    });
    
    return objectKey;
  } catch (err) {
    console.error('Failed to upload image:', err);
    return null;
  }
}

export const PRODUCT_IMAGES_BUCKET = BUCKET_NAME;