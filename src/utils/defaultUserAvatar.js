export const DEFAULT_USER_AVATAR =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
    + '<rect width="96" height="96" rx="24" fill="#0f1115"/>'
    + '<rect x="1" y="1" width="94" height="94" rx="23" fill="none" stroke="rgba(255,255,255,0.08)"/>'
    + '<circle cx="48" cy="38" r="14" fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="4"/>'
    + '<path d="M22 82c4-14 15-22 26-22s22 8 26 22" fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="4" stroke-linecap="round"/>'
    + '</svg>'
  );

export function getUserAvatarSrc(u) {
  return u?.avatarBase64 || u?.avatarUrl || DEFAULT_USER_AVATAR;
}
