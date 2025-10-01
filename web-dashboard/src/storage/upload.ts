import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';

export async function uploadMenuImages(ownerUid: string, files: File[]): Promise<string[]> {
  const uploadedUrls: string[] = [];
  for (const file of files) {
    const path = `images/${ownerUid}/${Date.now()}-${file.name}`;
    const objectRef = ref(storage, path);
    const snapshot = await uploadBytes(objectRef, file, {
      contentType: file.type,
    });
    const downloadUrl = await getDownloadURL(snapshot.ref);
    uploadedUrls.push(downloadUrl);
  }
  return uploadedUrls;
}
