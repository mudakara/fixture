/**
 * Constructs the full URL for uploaded images
 * @param imagePath - The image path from the database (e.g., "/uploads/events/image.jpg")
 * @returns The full URL to access the image
 */
export function getImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return '';
  
  // Extract the base URL without the /api part
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3501';
  
  // If the image path already starts with http, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Ensure the path starts with /
  const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  return `${baseUrl}${normalizedPath}`;
}