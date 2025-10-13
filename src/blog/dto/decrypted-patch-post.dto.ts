import { PatchPostDto } from './patch-post.dto';

export class DecryptedPatchPostDto {
  readonly decryptedPostId: number;
  readonly title?: PatchPostDto['title'];
  readonly contents?: PatchPostDto['contents'];

  constructor(
    decryptedPostId: number,
    title?: PatchPostDto['title'],
    contents?: PatchPostDto['contents'],
  ) {
    this.decryptedPostId = decryptedPostId;
    this.title = title;
    this.contents = contents;
  }
}
